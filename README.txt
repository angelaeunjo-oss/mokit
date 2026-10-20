모킷 - Netlify 배포용 프로젝트

중요: 이 ZIP은 소스 프로젝트입니다. Netlify의 수동 드래그앤드롭 배포는 보통 빌드된 dist 폴더가 필요합니다. 이 ZIP 자체를 Netlify Drop에 올리면 자동으로 빌드되지 않을 수 있습니다.

프로젝트에 연결된 Supabase 환경 변수:
VITE_SUPABASE_URL = https://uhnretywnoulkqhnqlbx.supabase.co
VITE_SUPABASE_ANON_KEY = Supabase의 sb_publishable_... 공개 키

Netlify에서 Git 연동으로 배포할 경우:
- Build command: npm run build
- Publish directory: dist
- 환경 변수 2개를 Site configuration > Environment variables에 추가

로그인 이메일은 admin@mokit.local 이며, 관리자 비밀번호는 Supabase Authentication > Users에서 만든 계정의 비밀번호입니다. README에 예시로 있던 1122를 그대로 사용하지 말고, 실제 생성한 비밀번호를 사용하세요.

절대 service_role 또는 sb_secret 키를 프런트엔드 환경 변수에 넣지 마세요.
