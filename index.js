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
    
    // 포워딩 이메일 주소가 정의된 경우에 한하여 메시지 전달(Forwarding) 트랜잭션을 수행합니다.
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
      .trim();

    /**
     * @description
     * 텍스트 내에 잔존하는 원시 URL(Raw URL) 문자열을 정규표현식으로 탐색하여 
     * Discord Webhook 지원 마크다운 형식의 단일 텍스트로 일괄 치환합니다.
     */
    body = body.replace(/(https?:\/\/[^\s\)]+)/g, (match) => {
      // 후행 구두점이 URL에 포함되는 것을 방지하기 위한 정제 로직
      const cleanUrl = match.replace(/[.,;]$/, '');
      return `[🔗](${cleanUrl})`;
    });

    // 디스코드 Webhook Embed 필드의 최대 허용 길이(Description Limit)에 맞춰 1500자로 슬라이싱합니다.
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