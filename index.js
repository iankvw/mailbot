import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    const discordUrl = env.DISCORD_WEBHOOK_URL;
    const forwardEmail = env.FORWARD_EMAIL;

    let forwardStatus = "";
    try {
      await message.forward(forwardEmail);
    } catch(e) {
      forwardStatus = "\nDelivery Failed to " + forwardEmail;
    }
    
    const parser = new PostalMime();
    const email = await parser.parse(message.raw);
    
    // 텍스트 필드 내부에 <table> 또는 <div> 등의 HTML 태그가 과도하게 포함된 쓰레기 데이터인지 검증합니다.
    const isTextGarbage = email.text && (email.text.includes('<table') || email.text.includes('<div'));
    
    // 텍스트 필드가 손상되었을 경우 HTML 필드를 우선 채택하며, 둘 다 없을 경우 기본값을 할당합니다.
    let rawBody = (isTextGarbage && email.html) ? email.html : (email.text || email.html || "내용이 없거나 이미지만 있는 메일입니다.");

    // 통합 문자열 정제 파이프라인 (Unified String Normalization Pipeline)
    let body = rawBody
      // 1. <style> 및 <script> 블록을 내부 콘텐츠와 함께 완전히 제거합니다. (다중 행 매칭 적용)
      .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
      // 2. 잔여하는 모든 종류의 HTML 태그를 강제로 제거합니다.
      .replace(/<[^>]+>/g, '')
      // 3. &zwnj;, &nbsp;, &copy; 등 모든 정규화된 HTML 엔티티 코드를 단일 공백으로 치환합니다.
      .replace(/&[a-zA-Z0-9#]+;/g, ' ')
      // 4. 개행 후 단독으로 존재하는 마침표(.) 라인을 정규식으로 매칭하여 삭제합니다. (줄 공백 포함)
      .replace(/^\s*\.\s*$/gm, '')
      // 5. 2개 이상의 연속된 가로 공백(Space, Tab)을 단일 공백으로 압축합니다.
      .replace(/[ \t]{2,}/g, ' ')
      // 6. 3개 이상의 연속된 수직 개행(Line-break)을 단일 개행으로 압축하여 불필요한 여백을 최소화합니다.
      .replace(/(\r?\n\s*){3,}/g, '\n')
      // 7. 문자열 양끝의 무의미한 공백 및 개행을 트리밍합니다.
      .trim()
      // 8. 디스코드 Webhook Embed 필드의 최대 허용 길이(Description Limit)에 맞춰 1500자로 슬라이싱합니다.
      .slice(0, 1500);

    /**
     * @description
     * Optional Chaining(?.)을 적용하여 email.from 객체가 존재하지 않거나 불완전할 경우 발생하는 런타임 에러를 방지합니다.
     */
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
     * 외부 API(Discord Webhook) 통신 시 발생할 수 있는 네트워크 예외 및 HTTP 오류 상태를 핸들링합니다.
     */
    try {
      const response = await fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(embedPayload)
      });

      // HTTP 상태 코드가 200~299 범위가 아닐 경우 에러 로깅 처리
      if (!response.ok) {
        console.error(`Discord Webhook 전송 실패: HTTP Status ${response.status}`);
      }
    } catch (error) {
      console.error("Discord Webhook 전송 중 네트워크 예외 발생:", error);
    }
  }
};