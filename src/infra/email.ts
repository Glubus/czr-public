export type AccountEmail = {
  send(message: { to: string; subject: string; text: string; html?: string }): Promise<void>;
};

export type EmailConfiguration =
  | { mode: "log"; includeContent?: boolean }
  | { mode: "resend"; apiKey: string; from: string };

export function createAccountEmail(configuration: EmailConfiguration): AccountEmail {
  if (configuration.mode === "log") {
    return {
      send: (message) => {
        console.log(JSON.stringify(
          configuration.includeContent
            ? { event: "account_email", ...message, html: undefined }
            : { event: "account_email_suppressed", subject: message.subject },
        ));
        return Promise.resolve();
      },
    };
  }

  return {
    send: async (message) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${configuration.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ from: configuration.from, ...message }),
      });
      if (!response.ok) {
        throw new Error(`email provider returned ${response.status}`);
      }
    },
  };
}
