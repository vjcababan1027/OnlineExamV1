async function test() {
  const url = 'https://script.google.com/macros/s/AKfycbxkIG96iNm6vXF4cKkTQUpUmjetYCNukNpebmYYjUcZ2lGa3SmMbs385bazDXsCD2PZ7w/exec';
  
  // 1. Login
  const loginRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'teacherLogin', passcode: '102799' }),
    redirect: 'follow'
  });
  const loginData = await loginRes.json();
  console.log('Login result:', loginData);
  const token = loginData.token;

  // 2. Get Exams
  const examsRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getExams', token }),
    redirect: 'follow'
  });
  const examsData = await examsRes.json();
  console.log('Exams result:', examsData);

  if (!examsData.exams || examsData.exams.length === 0) {
    console.log('No exams found.');
    return;
  }

  const testExam = examsData.exams[0];
  const examId = testExam['Exam ID'];
  console.log('Testing with Exam ID:', examId, 'Title:', testExam['Title']);

  // 3. Test Add Student
  console.log('\n--- Testing addStudent ---');
  const addRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'addStudent',
      token,
      examId,
      name: 'Test Student John',
      section: 'Section A'
    }),
    redirect: 'follow'
  });
  const addData = await addRes.text();
  console.log('addStudent response raw:', addData);

  // 5. Test student verification (Student Login)
  console.log('\n--- Testing studentVerify ---');
  const verifyRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'studentVerify',
      examCode: testExam['Code'],
      studentId: 'STU-47901'
    }),
    redirect: 'follow'
  });
  const verifyData = await verifyRes.json();
  console.log('studentVerify result:', verifyData);

  // 6. Test duplicate student ID add
  console.log('\n--- Testing addStudent with duplicate ID ---');
  const dupRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'addStudent',
      token,
      examId,
      name: 'Duplicate Student Test',
      section: 'Section A',
      studentId: 'STU-47901'
    }),
    redirect: 'follow'
  });
  const dupData = await dupRes.json();
  console.log('addStudent duplicate response:', dupData);
}

test().catch(console.error);
