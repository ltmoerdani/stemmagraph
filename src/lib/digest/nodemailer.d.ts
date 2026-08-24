// Ambient declaration for the narrow nodemailer surface the digest
// mailer uses (P2-7). nodemailer 9 ships without bundled types and the
// task allows exactly one new root dependency, so instead of pulling
// @types/nodemailer the two functions actually called are declared here,
// fully typed, next to their only consumer.

declare module 'nodemailer' {
  export interface SendMailOptions {
    from: string;
    to: string;
    subject: string;
    text: string;
  }

  export interface SentMessageInfo {
    readonly messageId?: string;
    readonly accepted?: readonly string[];
    readonly rejected?: readonly string[];
  }

  export interface Transporter {
    sendMail(options: SendMailOptions): Promise<SentMessageInfo>;
    verify?(): Promise<true>;
  }

  export function createTransport(transportUrl: string): Transporter;
}
