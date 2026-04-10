import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    const discordUrl = "https://discord.com/api/webhooks/webhookurl";
    const forwardEmail = "someone@example.com";

    let forwardStatus = "";
    try {
      await message.forward(forwardEmail);
    } catch(e) {
      forwardStatus = "\nDelivery Failed to " + forwardEmail;
    }
    
    const parser = new PostalMime();
    const email = await parser.parse(message.raw);

    let body = email.text || email.html?.replace(/<[^>]*>/g, '') || "본문 없음";
    body = body.trim().slice(0, 1500);

    const embedDescription = `${body}\n\nFrom: \`${email.from.address}\` (${email.from.name || '이름없음'})\nTo: \`${message.to}\`${forwardStatus}`;

    const embedPayload = {
      embeds: [{
        title: `${email.subject || "제목 없음"}`,
        description: embedDescription,
        color: forwardStatus ? 16711680 : 3447003,
      }]
    };

    await fetch(discordUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(embedPayload)
    });
  }
};