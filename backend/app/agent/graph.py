"""The interview agent as a LangGraph state graph.

The graph runs once per user action and the database is the source of truth, so no state
is kept in memory between requests (server restarts on free hosting lose nothing).

    action=start  : plan_round -> generate_question
    action=answer : score_answer -> update_memory
    action=next   : decide_next -> generate_question | summarize_round

Print the diagram with:  python -m app.agent.graph
"""

from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from app.agent.nodes import (
    InterviewState,
    decide_next,
    generate_question,
    plan_round,
    score_answer,
    summarize_round,
    update_memory,
)

ENTRY_FOR_ACTION = {"start": "plan_round", "answer": "score_answer", "next": "decide_next"}


@lru_cache
def build_graph():
    graph = StateGraph(InterviewState)
    graph.add_node("plan_round", plan_round)
    graph.add_node("generate_question", generate_question)
    graph.add_node("score_answer", score_answer)
    graph.add_node("update_memory", update_memory)
    graph.add_node("decide_next", decide_next)
    graph.add_node("summarize_round", summarize_round)

    # Where to start depends on what the user did.
    graph.add_conditional_edges(
        START,
        lambda state: ENTRY_FOR_ACTION[state["action"]],
        list(ENTRY_FOR_ACTION.values()),
    )

    graph.add_edge("plan_round", "generate_question")
    graph.add_edge("generate_question", END)

    graph.add_edge("score_answer", "update_memory")
    graph.add_edge("update_memory", END)

    graph.add_conditional_edges(
        "decide_next",
        lambda state: state["next_step"],
        ["generate_question", "summarize_round"],
    )
    graph.add_edge("summarize_round", END)
    return graph.compile()


if __name__ == "__main__":
    print(build_graph().get_graph().draw_mermaid())
