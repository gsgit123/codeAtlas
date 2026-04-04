import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

groq_clinet=Groq(api_key=os.getenv("GROQ_API_KEY"))

ROUTE_DESCRIPTIONS={
    "impact":     "Questions about what breaks, what is affected, or what depends on a file/function",
    "trace":      "Questions about tracing a flow, request path, or connection between two things",
    "structural": "Questions about file count, most important files, hubs, cycles, or project structure",
    "behavioral": "Questions about how something works, what a function does, or code logic"
}


def classify_query(question:str)->str:
    prompt=f"""You are a query classifier for a code intelligence system.
    Classify the following question into EXACTLY ONE of these categories:
- impact:     {ROUTE_DESCRIPTIONS['impact']}
- trace:      {ROUTE_DESCRIPTIONS['trace']}
- structural: {ROUTE_DESCRIPTIONS['structural']}
- behavioral: {ROUTE_DESCRIPTIONS['behavioral']}
Question: {question}
Reply with ONLY the single category word. Nothing else. No punctuation."""

    response=groq_clinet.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role":"user","content":prompt}],
        max_tokens=10,
        temperature=0.0
    )

    label=response.choices[0].message.content.strip().lower()

    if label not in ROUTE_DESCRIPTIONS:
        print(f"  [Router] Unknown label '{label}', defaulting to 'behavioral'")
        label="behavioral"
    
    print(f"  [Router] Classified as '{label}'")
    return label