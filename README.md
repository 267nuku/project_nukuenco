<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Mori Concierge - 누쿠앤코 라이프스타일 큐레이터

누쿠앤코의 AI 라이프스타일 어시스턴트 '모리'와의 실시간 대화 애플리케이션입니다.

## 환경 변수 설정 가이드

### 로컬 개발 환경

1. `.env.local` 파일을 프로젝트 루트에 생성합니다:
```bash
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

2. API 키는 [Google AI Studio](https://aistudio.google.com)에서 발급받을 수 있습니다.

### GitHub Pages 배포

1. GitHub 저장소의 **Settings** > **Secrets and variables** > **Actions** 로 이동합니다
2. **New repository secret** 버튼을 클릭합니다
3. **Name**: `VITE_GEMINI_API_KEY`
4. **Secret**: 발급받은 API 키를 입력합니다
5. **Add secret** 버튼을 클릭합니다

> **주의**: 환경 변수는 반드시 `VITE_` 접두사를 붙여야 Vite에서 인식됩니다.

## 로컬 실행 방법

**필수 사항:**  Node.js (v18 이상)

1. 의존성 설치:
   ```bash
   npm install
   ```

2. 환경 변수 설정 (.env.local 파일 생성):
   ```bash
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. 앱 실행:
   ```bash
   npm run dev
   ```

## 기능

- **라이브 음성 대화**: 모리와 실시간 음성 대화
- **텍스트 기반 대화**: 채팅을 통한 스타일링 상담
- **이미지 생성**: AI가 생성한 패션 및 라이프스타일 이미지
- **디렉터 모드**: 아틀리에 편집 및 커스터마이징
- **API 상태 표시**: 상단 네비게이션에서 모리 준비 상태 확인

## 문제 해결

### "Mori Ready" 표시가 아닌 "API Error"가 보이는 경우

1. `.env.local` 파일이 프로젝트 루트에 있는지 확인합니다
2. `VITE_GEMINI_API_KEY=` 다음에 API 키가 올바르게 입력되었는지 확인합니다
3. 개발 서버를 다시 시작합니다 (`npm run dev`)

### 라이브 대화에서 응답이 없는 경우

1. 상단 네비게이션의 API 상태 표시를 확인합니다
2. 브라우저 콘솔 (F12)에서 에러 메시지를 확인합니다
3. 마이크 권한이 허용되었는지 확인합니다


