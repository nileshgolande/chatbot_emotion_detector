# Emotion chat

- **Backend:** `emotion_chat/` — Django + DRF (`manage.py runserver`)
- **Frontend:** `frontend/` — React (`npm start`)

Copy `.env` from your team template; Django reads `emotion_chat/.env`.

Chat replies are orchestrated with **LangGraph** (`emotion_chat/chat/langgraph_chat.py`). Set `USE_LANGGRAPH_CHAT=0` in `.env` to bypass the graph and call the LLM helper directly.
