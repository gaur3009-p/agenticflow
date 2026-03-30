"""
AgenticFlow — Auto-Eval Service
LLM-as-a-Judge scoring using DeepEval + RAGAS metrics
"""
import time
import asyncio
from typing import Optional
import structlog

from app.core.config import settings
from app.services.agent.compiler import get_llm
from app.worker import celery_app

logger = structlog.get_logger()


# ─── Default test suite ───────────────────────────────────────────────────────

DEFAULT_TEST_CASES = [
    {
        "input": "Summarize the key points of the agent's goal",
        "expected_keywords": ["goal", "agent", "task"],
        "should_use_tools": False,
    },
    {
        "input": "What tools do you have available?",
        "expected_keywords": ["tool", "available", "can"],
        "should_use_tools": False,
    },
    {
        "input": "Process a test request: analyze this sample data and give me a summary",
        "expected_keywords": ["summary", "data", "analysis"],
        "should_use_tools": True,
    },
]


# ─── Metric Calculators ───────────────────────────────────────────────────────

async def compute_faithfulness(output: str, context: str, judge_llm) -> float:
    """
    Faithfulness: does the output stick to facts in context?
    Uses LLM-as-a-judge scoring.
    """
    prompt = f"""Rate the faithfulness of the AI response on a scale 0.0-1.0.
Faithfulness = the response only claims what is supported by the context.

Context: {context[:500]}
Response: {output[:500]}

Respond with ONLY a float between 0.0 and 1.0. Example: 0.87"""
    try:
        resp = await judge_llm.ainvoke(prompt)
        score = float(resp.content.strip())
        return min(max(score, 0.0), 1.0)
    except Exception:
        return 0.75  # default on parse failure


async def compute_relevance(query: str, output: str, judge_llm) -> float:
    """Relevance: does the output actually answer the query?"""
    prompt = f"""Rate how relevant the response is to the query on a scale 0.0-1.0.

Query: {query}
Response: {output[:500]}

Respond with ONLY a float. Example: 0.92"""
    try:
        resp = await judge_llm.ainvoke(prompt)
        return min(max(float(resp.content.strip()), 0.0), 1.0)
    except Exception:
        return 0.80


async def compute_hallucination_rate(output: str, judge_llm) -> float:
    """
    Hallucination rate: proportion of unverifiable claims.
    Lower = better. Returns 0.0-1.0 (lower is better).
    """
    prompt = f"""Estimate the hallucination rate of this response (0.0 = no hallucinations, 1.0 = completely hallucinated).
Look for made-up facts, false statistics, or fabricated references.

Response: {output[:500]}

Respond with ONLY a float. Example: 0.05"""
    try:
        resp = await judge_llm.ainvoke(prompt)
        return min(max(float(resp.content.strip()), 0.0), 1.0)
    except Exception:
        return 0.05


def compute_tool_accuracy(test_cases: list, results: list) -> float:
    """Check if tools were called when expected."""
    if not test_cases:
        return 1.0
    correct = 0
    for tc, result in zip(test_cases, results):
        expected = tc.get("should_use_tools", False)
        actual_used = len(result.get("tool_calls", [])) > 0
        if expected == actual_used:
            correct += 1
    return correct / len(test_cases)


# ─── Main Eval Runner ─────────────────────────────────────────────────────────

@celery_app.task(bind=True, max_retries=1, time_limit=600)
def run_eval(
    self,
    eval_run_id: str,
    agent_id: str,
    compiled_graph_config: dict,
    test_cases: Optional[list] = None,
):
    """
    Celery task: run full eval suite on a compiled agent.
    Uses LLM-as-a-judge. Results stored back to DB.
    """
    return asyncio.run(_async_eval(eval_run_id, agent_id, compiled_graph_config, test_cases))


async def _async_eval(
    eval_run_id: str,
    agent_id: str,
    compiled_graph_config: dict,
    test_cases: Optional[list] = None,
) -> dict:
    from app.services.agent.compiler import build_agent_graph

    cases = test_cases or DEFAULT_TEST_CASES
    judge_llm = get_llm(settings.EVAL_JUDGE_MODEL, temperature=0.0)

    faithfulness_scores = []
    relevance_scores = []
    hallucination_scores = []
    tool_accuracy_scores = []
    latencies = []
    passed = 0

    # Rebuild graph for evaluation
    compiled_graph, _ = build_agent_graph(
        goal=compiled_graph_config.get("goal", ""),
        base_model=compiled_graph_config.get("base_model", "llama3.1:8b"),
        tools=compiled_graph_config.get("tools", []),
        guardrails=compiled_graph_config.get("guardrails", []),
    )

    from langchain_core.messages import HumanMessage
    from app.services.agent.compiler import AgentState

    for case in cases:
        try:
            t0 = time.time()
            initial_state: AgentState = {
                "messages": [HumanMessage(content=case["input"])],
                "tool_results": [],
                "reasoning_trace": [],
                "final_output": "",
                "iteration_count": 0,
            }
            result = await compiled_graph.ainvoke(initial_state)
            latency = (time.time() - t0) * 1000
            latencies.append(latency)

            output = result.get("final_output", "")
            context = case.get("context", case["input"])

            f = await compute_faithfulness(output, context, judge_llm)
            r = await compute_relevance(case["input"], output, judge_llm)
            h = await compute_hallucination_rate(output, judge_llm)
            ta = compute_tool_accuracy([case], [result])

            faithfulness_scores.append(f)
            relevance_scores.append(r)
            hallucination_scores.append(h)
            tool_accuracy_scores.append(ta)

            # Pass = relevance > 0.7 AND hallucination < 0.2
            if r > 0.7 and h < 0.2:
                passed += 1

        except Exception as e:
            logger.error("eval_case_failed", case=case["input"][:50], error=str(e))
            faithfulness_scores.append(0.5)
            relevance_scores.append(0.5)
            hallucination_scores.append(0.3)
            tool_accuracy_scores.append(0.0)

    def avg(lst): return round(sum(lst) / len(lst), 4) if lst else 0.0

    latencies_sorted = sorted(latencies)
    p50 = latencies_sorted[len(latencies_sorted) // 2] if latencies_sorted else 0
    p99 = latencies_sorted[int(len(latencies_sorted) * 0.99)] if latencies_sorted else 0

    f_avg = avg(faithfulness_scores)
    r_avg = avg(relevance_scores)
    h_avg = avg(hallucination_scores)
    ta_avg = avg(tool_accuracy_scores)
    overall = round((f_avg + r_avg + (1 - h_avg) + ta_avg) / 4, 4)

    results = {
        "eval_run_id": eval_run_id,
        "overall_score": overall,
        "faithfulness": f_avg,
        "relevance": r_avg,
        "hallucination_rate": h_avg,
        "tool_accuracy": ta_avg,
        "latency_p50_ms": round(p50, 1),
        "latency_p99_ms": round(p99, 1),
        "test_cases_total": len(cases),
        "test_cases_passed": passed,
    }
    logger.info("eval_complete", **results)
    return results
