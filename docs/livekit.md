## LiveKit Local Dev Server Token Generation

**Command to generate token (run in terminal):**
```bash
/opt/homebrew/bin/lk token create --api-key devkey --api-secret secret --join --room test-room --identity test-agent --valid-for 24h
```

**Generated Token (valid for 24h from generation time):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDg1MTQ2NjIsImlzcyI6ImRldmtleSIsIm5hbWUiOiJ0ZXN0LWFnZW50IiwibmJmIjoxNzQ4NDI4MjYyLCJzdWIiOiJ0ZXN0LWFnZW50IiwidmlkZW8iOnsicm9vbSI6InRlc3Qtcm9vbSIsInJvb21Kb2luIjp0cnVlfX0.stXHNlkrrGGVqjYxrNbYVOteTRgv3kqmpgFHYY3Y9iw
```

**LiveKit Server URL (from docker-compose):**
`ws://localhost:7880`


LIVEKIT_TEST_WS_URL='ws://localhost:7880' LIVEKIT_TEST_TOKEN='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDg1MTQ2NjIsImlzcyI6ImRldmtleSIsIm5hbWUiOiJ0ZXN0LWFnZW50IiwibmJmIjoxNzQ4NDI4MjYyLCJzdWIiOiJ0ZXN0LWFnZW50IiwidmlkZW8iOnsicm9vbSI6InRlc3Qtcm9vbSIsInJvb21Kb2luIjp0cnVlfX0.stXHNlkrrGGVqjYxrNbYVOteTRgv3kqmpgFHYY3Y9iw' npx vitest run tests/test_system_livekit.ts