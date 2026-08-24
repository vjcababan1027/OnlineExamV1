async function test() {
  const url = 'https://script.google.com/macros/s/AKfycbxkIG96iNm6vXF4cKkTQUpUmjetYCNukNpebmYYjUcZ2lGa3SmMbs385bazDXsCD2PZ7w/exec';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'teacherLogin', passcode: '102799' }),
    redirect: 'follow'
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response text:', text);
}
test().catch(console.error);
