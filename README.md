# 🌍 Global Journey - Interactive 3D World Travel Visualization

세계 여행을 3D 지구본으로 시각화하고, AI 여행 매니저와 함께 여행을 계획하세요!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Dazzlar199/journey)

## ✨ 주요 기능

### 🗺️ 인터랙티브 3D 지구본
- **Three.js** 기반 실시간 3D 렌더링
- 12개 주요 도시 자동 여행 애니메이션
- 마커 클릭으로 원하는 도시 정보 즉시 확인
- 부드러운 카메라 전환과 비행기 애니메이션

### 🤖 AI 여행 매니저 (Sigma)
- **GPT-4** 기반 맞춤형 여행 상담
- 실시간 도시별 예산 정보 제공
- 구조화된 답변 (섹션, 리스트, 강조 표시)
- 한글 지원 및 전문적인 조언

### 💰 상세 예산 가이드
- 3가지 여행 스타일 (백패커/중급/럭셔리)
- 항목별 비용 분석 (숙박, 식사, 교통, 관광)
- 일일 예산 및 총 경비 자동 계산
- 12개 도시 전체 예산 데이터베이스

### 🎯 여행 정보
- 주요 관광지 추천
- 현지 음식 리스트
- 여행 팁 및 주의사항
- 각 도시별 스토리

## 🚀 빠른 시작

### 로컬 개발

1. **저장소 클론**
\`\`\`bash
git clone https://github.com/Dazzlar199/journey.git
cd journey
\`\`\`

2. **환경 변수 설정**
\`\`\`bash
cp .env.example .env
\`\`\`

\`.env\` 파일을 열고 OpenAI API 키를 입력하세요:
\`\`\`env
OPENAI_API_KEY=sk-your-actual-api-key-here
\`\`\`

3. **로컬 서버 실행**
\`\`\`bash
# Python이 설치되어 있다면
cd dist
python3 -m http.server 9000

# 또는 Node.js http-server
npx http-server dist -p 9000
\`\`\`

4. **브라우저에서 열기**
\`\`\`
http://localhost:9000
\`\`\`

## 🌐 Vercel 배포

### 1클릭 배포

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Dazzlar199/journey)

### 수동 배포

1. **Vercel CLI 설치**
\`\`\`bash
npm i -g vercel
\`\`\`

2. **배포**
\`\`\`bash
vercel
\`\`\`

3. **환경 변수 설정**
Vercel 대시보드에서:
- Settings → Environment Variables
- \`OPENAI_API_KEY\` 추가
- Production, Preview, Development 모두 체크

### GitHub 연동 자동 배포

1. Vercel에서 GitHub 저장소 연동
2. 환경 변수 \`OPENAI_API_KEY\` 추가
3. \`main\` 브랜치에 푸시하면 자동 배포

## 📂 프로젝트 구조

\`\`\`
three-js-earth/
├── api/
│   └── chat.js           # OpenAI API 서버리스 함수
├── dist/
│   ├── index.html        # 메인 HTML
│   ├── script.js         # 3D 렌더링 + 챗봇 로직
│   └── style.css         # 스타일시트
├── src/
│   └── index.html        # 소스 HTML
├── .env.example          # 환경 변수 템플릿
├── .gitignore           # Git 제외 파일
└── README.md            # 프로젝트 문서
\`\`\`

## 🎮 사용 방법

### 자동 여행 모드
1. 화면 하단 중앙의 **PLAY** 버튼 클릭
2. 비행기가 자동으로 12개 도시를 여행
3. 각 도시에서 5초간 자동 정지하며 정보 표시
4. **CONTINUE** 버튼으로 다음 도시로 이동

### 수동 탐색 모드
1. 지구본을 마우스로 회전
2. 빨간 마커 클릭으로 원하는 도시 정보 확인
3. 오른쪽 상단에 상세 정보 패널 표시

### AI 여행 상담
1. 왼쪽 하단 챗봇 버튼 클릭
2. "서울 3일 백패커 예산 알려줘" 같은 질문 입력
3. 구조화된 답변 확인
4. 빠른 질문 버튼 활용

## 🗺️ 포함된 도시

1. 🇰🇷 **서울** - 전통과 현대의 조화
2. 🇯🇵 **도쿄** - 미슐랭 스타의 도시
3. 🇹🇭 **방콕** - 천사의 도시
4. 🇦🇪 **두바이** - 사막 위의 미래 도시
5. 🇫🇷 **파리** - 사랑과 예술의 도시
6. 🇮🇹 **로마** - 영원의 도시
7. 🇪🇸 **바르셀로나** - 가우디의 도시
8. 🇬🇧 **런던** - 왕실의 도시
9. 🇺🇸 **뉴욕** - 잠들지 않는 도시
10. 🇺🇸 **샌프란시스코** - 금문교의 도시
11. 🇺🇸 **로스앤젤레스** - 스타의 도시
12. 🇦🇺 **시드니** - 남반구의 보석

## 🛠️ 기술 스택

### Frontend
- **Three.js r73** - 3D 그래픽 렌더링
- **OrbitControls** - 3D 카메라 컨트롤
- **dat.GUI** - 디버깅 UI
- **Vanilla JavaScript** - 순수 자바스크립트

### Backend (Serverless)
- **Vercel Serverless Functions** - API 엔드포인트
- **OpenAI GPT-4** - AI 챗봇
- **Node.js Fetch API** - HTTP 요청

### Design
- **Apple System Fonts** - 깔끔한 타이포그래피
- **Gradient UI** - 현대적인 디자인
- **Responsive Layout** - 반응형 레이아웃

## 📊 예산 데이터

각 도시별 3가지 여행 스타일 예산 제공:

| 스타일 | 숙박 | 식사 | 예시 (서울 1일) |
|--------|------|------|-----------------|
| 백패커 | 게스트하우스 | 현지 식당 | \$83 |
| 중급 | 3성급 호텔 | 레스토랑 | \$173 |
| 럭셔리 | 5성급 호텔 | 고급 레스토랑 | \$433 |

## 🔑 환경 변수

| 변수명 | 설명 | 필수 |
|--------|------|------|
| \`OPENAI_API_KEY\` | OpenAI API 키 | ✅ |

OpenAI API 키 발급: https://platform.openai.com/api-keys

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit your Changes (\`git commit -m 'Add some AmazingFeature'\`)
4. Push to the Branch (\`git push origin feature/AmazingFeature\`)
5. Open a Pull Request

## 📝 라이선스

MIT License - 자유롭게 사용 가능

## 🙏 감사

- Three.js 커뮤니티
- OpenAI GPT-4
- Unsplash (이미지 제공)
- CDN.js (라이브러리 호스팅)

## 📧 문의

프로젝트 링크: [https://github.com/Dazzlar199/journey](https://github.com/Dazzlar199/journey)

---

⭐️ 이 프로젝트가 마음에 드셨다면 Star를 눌러주세요!
