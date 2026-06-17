# 📬 Mailbot: Cloudflare Workers Email to Discord Forwarder

Cloudflare Workers 및 GitHub Actions 기반의 스마트 이메일 수신 및 디스코드(Discord) 웹훅 포워딩 인프라입니다. 수신된 이메일을 실시간으로 파싱하고, 텍스트 본문을 최적화하여 지정된 디스코드 채널로 정제된 Rich Embed 알림을 전송합니다.

---

## ✨ 주요 기능 (Key Features)

- **이메일 구문 분석 (Email Parsing)**: `postal-mime` 라이브러리를 활용하여 MIME 형식의 원시 이메일 데이터를 정밀하게 분해 및 객체화합니다.
- **통합 문자열 정제 파이프라인 (Unified String Normalization)**: 정규표현식을 통해 HTML 태그, 내부 스타일시트, 스크립트 및 잔존 엔티티 문자열을 강제 제거하고 연속된 여백을 압축하여 본문 가독성을 극대화합니다.
- **URL 마크다운 자동 치환**: 본문 내부의 원시 URL(Raw URL)을 탐색하여 디스코드 인라인 하이퍼링크 문법(`[🔗](URL)`)으로 일괄 변환합니다.
- **임베드 자수 절삭 보호 (Truncation Protection)**: 디스코드 Embed Description 필드의 글자 수 제한을 고려하여 본문을 3,500자로 제한하며, 문자열 절삭 시 불완전하게 종료된 마크다운 링크 문법`([text](url) 구조의 파손)`을 안전하게 감지하여 제거합니다.
- **동적 다중 라우팅 (Dynamic Multi-Routing)**: 수신자 주소별 개별 디스코드 웹훅 엔드포인트 및 이메일 2차 포워딩 설정을 지원하며, 예외 주소 처리를 위한 `catch_all` 폴백 구조를 포함합니다.
- **환경 변수 은닉 및 보안 (Security)**: 민감한 라우팅 데이터(웹훅 API Key 등)를 Cloudflare Secrets 환경 변수로 관리하여, 소스코드가 퍼블릭 저장소에 노출되어도 자격 증명이 유출되지 않도록 설계되었습니다.

---

## 🛠️ 기술 스택 (Tech Stack)

- **Runtime**: Cloudflare Workers (V8 Engine)
- **Language**: JavaScript (ES6+)
- **Libraries**: `postal-mime`
- **Tooling**: Wrangler CLI v4
- **CI/CD**: GitHub Actions

---

## 🚀 시작하기 (Getting Started)

### 1. Prerequisites
- Cloudflare 계정 및 커스텀 도메인 (Cloudflare Email Routing 활성화 필요)
- 알림을 수신할 Discord 채널의 Webhook URL

### 2. 환경 변수 및 시크릿 설정 (Environment Secrets)

퍼블릭 레포지토리의 보안 유지를 위해 진짜 라우팅 맵 데이터는 Cloudflare 대시보드 내에 **Secret 변수**로 저장해야 합니다.

1. Cloudflare 대시보드 ➔ **Workers & Pages** ➔ 생성된 Worker 선택 ➔ **Settings** ➔ **Variables and Secrets**로 이동합니다.
2. **Secrets** 영역에 `ROUTING_SECRET`이라는 이름으로 아래 구조의 진짜 데이터를 JSON 문자열 형태로 등록합니다.

```json
{
  "user1@yourdomain.com": {
    "webhookUrl": "https://discord.com/api/webhooks/YOUR_REAL_WEBHOOK_TOKEN_1",
    "forwardEmail": "backup1@example.com"
  },
  "catch_all": {
    "webhookUrl": "https://discord.com/api/webhooks/YOUR_DEFAULT_WEBHOOK_TOKEN",
    "forwardEmail": "default-backup@example.com"
  }
}
```

### 3. 로컬 설정 설정 파일 (`wrangler.json`)

저장소에 푸시되는 `wrangler.json` 파일에는 실제 자격 증명 대신 아래와 같이 더미(Dummy) 데이터를 배치하여 템플릿 구조만 공개합니다.

```json
{
  "name": "mailbot",
  "main": "index.js",
  "compatibility_date": "2026-04-11",
  "vars": {
    "ROUTING_MAP": {
      "example@mydomain.com": {
        "webhookUrl": "https://discord.com/api/webhooks/YOUR_DISCORD_WEBHOOK_URL",
        "forwardEmail": "your_email@example.com"
      }
    }
  }
}
```

---

## 📦 CI/CD 자동화 배포 (Deployment)

본 저장소는 GitHub Actions를 통해 `main` 브랜치에 소스코드가 `push`될 때 자동으로 Cloudflare Workers 환경으로 빌드 및 배포됩니다.

### GitHub Secrets 설정
GitHub 저장소의 **Settings** ➔ **Secrets and variables** ➔ **Actions** 메뉴에서 아래 시크릿을 등록해야 합니다.

- `CLOUDFLARE_API_TOKEN`: Cloudflare Workers 편집 권한을 가진 API 토큰 키

```yaml
# .github/workflows/deploy.yml 전체 워크플로우 구성
name: Deploy Cloudflare Worker

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          packageManager: npm
          wranglerVersion: '4'
```