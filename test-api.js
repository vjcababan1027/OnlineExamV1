async function test() {
  const url = 'https://script.google.com/macros/s/AKfycbxkIG96iNm6vXF4cKkTQUpUmjetYCNukNpebmYYjUcZ2lGa3SmMbs385bazDXsCD2PZ7w/exec';
  
  // Login
  const loginRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'teacherLogin', passcode: '102799' }),
    redirect: 'follow'
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Login:', loginData.success ? 'OK' : 'FAILED');

  // Get first exam
  const examsRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getExams', token }),
    redirect: 'follow'
  });
  const examsData = await examsRes.json();
  const examId = examsData.exams?.[0]?.['Exam ID'];
  console.log('Using exam:', examsData.exams?.[0]?.['Title'], '| ID:', examId);

  // Build 54 students to simulate real usage
  const students = Array.from({ length: 54 }, (_, i) => `TestBatch Student ${String(i + 1).padStart(2, '0')}`);
  console.log(`\nSending ${students.length} students...`);
  const start = Date.now();
  
  const importRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'importStudents',
      token,
      examId,
      section: 'Section A',
      students
    }),
    redirect: 'follow'
  });

  const elapsed = Date.now() - start;
  const importData = await importRes.text();
  console.log(`\nResponse (${elapsed}ms):`);
  try {
    const parsed = JSON.parse(importData);
    console.log('success:', parsed.success);
    console.log('count:', parsed.count);
    if (!parsed.success) console.log('error:', parsed.error);
  } catch {
    // If the server returned HTML (script error), print it
    console.log(importData.substring(0, 800));
  }
}

test().catch(console.error);
