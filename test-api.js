async function test() {
  const url = 'https://script.google.com/macros/s/AKfycbyxlhUmDe7zHSEgQfaii4Kz2LRV9tniy4uATTi5yXFiaqbN82gny2wIFu94DJxaaycz/exec';
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
