Guest uploads CV:
1. front end creates guestSessionId in sessionStorage
2. backend received PDF & guestSessionId
3. CVAnalyse reads PDF text
4. Gemini extracts skills
5. Save CV in CV collection with guestSessionId (latest CV only)
6. Save skills in Skill collection with guestSessionId (alll the CV history)
7. guest signs up
8. Backend finds CV/Skill by guestSessionIf
9. Update them with candidateId
10. Clear guestSessionId