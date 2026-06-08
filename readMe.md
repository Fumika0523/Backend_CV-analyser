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

<!-- Why did you separate CV and Skill collections? -->

>> The CV collection stores upload history and analysis results for each version of candidate's CV. 
>> The Skill collection stores the candidate's latest skill profile, which can be queried quickly when matching candidates against job descriptions without scanning every CV document each time.

<!-- Creating candidate upload directory -->
When a candidate uploads a CV, the system creates a candidate-specific folder path using the candidate' numeric Id.
 Example:
 const uploadsDir = path.join(
    __dirname,
    "../uploads/cvs",
    candidateNumericId.toString()
)

If the candidate ID is 10, the resulting directory would be
uploads/cvs/10

Before saving the PDF, the application calls:

await ensureDirExists(uploadsDir)

This helper function uses fs.mkdir() with recursive: true to ensure that the directory exists. If the folder does not exists, it will be created automatically.

This prevents file file system errors when moving the uploaded PDF into its permanent location.

Example flow:

Candidate ID: 10

Final PDF:
uploads/cv/10/10_v1.pdf

Future Idea:

uploads/
 └─ candidates/
      └─ 10/
          ├─ cvs/
          │   ├─ 10_v1.pdf
          │   └─ 10_v2.pdf
          ├─ certificates/
          ├─ profile/
          └─ cover_letters/

          

------------------------------------------


