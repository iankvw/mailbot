import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    const routingMap = env.ROUTING_MAP || {};
    const currentRoute = routingMap[message.to] || routingMap["catch_all"];

    if (!currentRoute || !currentRoute.webhookUrl) {
      console.error(`수신자(${message.to}) 및 catch_all에 대한 유효한 라우팅 정보가 존재하지 않습니다.`);
      return;
    }

    const discordUrl = currentRoute.webhookUrl;
    const forwardEmail = currentRoute.forwardEmail;

    let forwardStatus = "";
    
    if (forwardEmail) {
      try {
        await message.forward(forwardEmail);
      } catch(e) {
        forwardStatus = "\nDelivery Failed to " + forwardEmail;
      }
    }
    
    const parser = new PostalMime();
    const email = await parser.parse(message.raw);
    
    const isTextGarbage = email.text && (email.text.includes('<table') || email.text.includes('<div'));
    let rawBody = (isTextGarbage && email.html) ? email.html : (email.text || email.html || "내용이 없거나 이미지만 있는 메일입니다.");

    /**
     * @description
     * HTML 본문의 앵커 태그(Anchor Tag, <a>)를 Discord 지원 마크다운(Markdown) 하이퍼링크 형식으로 선행 변환합니다.
     * 이후 진행되는 HTML 태그 일괄 제거 로직(<[^>]+>)에서 링크 정보가 소실되는 것을 방지하기 위한 전처리 과정입니다.
     */
    if (rawBody === email.html) {
      // <a href="URL">텍스트</a> 형태를 [텍스트](URL) 형태의 마크다운으로 치환
      rawBody = rawBody.replace(/<a\s+(?:[^>]*?\s+)?href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
    }

    // 통합 문자열 정제 파이프라인 (Unified String Normalization Pipeline)
    let body = rawBody
      // HTML 태그를 강제로 제거합니다.
      .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-zA-Z0-9#]+;/g, ' ')
      // 연속된 가로 공백, 개행을 압축하여 불필요한 여백을 최소화합니다.
      .replace(/^\s*\.\s*$/gm, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/(\r?\n\s*){3,}/g, '\n')
      .trim()
      // 디스코드 Webhook Embed 필드의 최대 허용 길이(Description Limit)에 맞춰 1500자로 슬라이싱합니다.

    body = body.replace(/(https?:\/\/[^\s\)]+)/g, (match) => {
      // 정규식 매칭 결과에서 불필요한 후행 구두점 제거를 위한 방어 로직
      const cleanUrl = match.replace(/[.,;]$/, '');
      
      // URL 문자열 길이가 50자를 초과할 경우 축약 표기로 치환하여 UI 레이아웃 붕괴를 방지
      if (cleanUrl.length > 50) {
        return `[🔗](${cleanUrl})`;
      }
      // 50자 이하의 정상적인 짧은 URL은 원형 보존
      return cleanUrl;
    });

    body = body.slice(0, 1500);

    const embedDescription = `${body}\n\nFrom: \`${email.from?.address || '주소없음'}\` (${email.from?.name || '이름없음'})\nTo: \`${message.to}\`${forwardStatus}`;

    const embedPayload = {
      embeds: [{
        title: `${email.subject || "제목 없음"}`,
        description: embedDescription,
        color: forwardStatus ? 16711680 : 3447003,
      }]
    };

    /**
     * @description
     * 매핑된 Discord Webhook API 엔드포인트로 정제된 페이로드를 비동기 전송(POST)합니다.
     */
    try {
      const response = await fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(embedPayload)
      });

      if (!response.ok) {
        console.error(`Discord Webhook 전송 실패: HTTP Status ${response.status}`);
      }
    } catch (error) {
      console.error("Discord Webhook 전송 중 네트워크 예외 발생:", error);
    }
  }
};
// npx wrangler deploy