import { loadTemplates } from './store';
import { cleanJordanianPhone } from './leadValidator';
import { updateLeadStatusInSheet } from './sheetsService';
import { DailyLogModel } from './models/DailyLog';

export interface AntiBanConfig {
  dailyCap?: number;
  batchCooldownEvery?: number;
  batchCooldownMinSeconds?: number;
  batchCooldownMaxSeconds?: number;
  sendWindowStart?: number;
  sendWindowEnd?: number;
  enableVariation?: boolean;
}

export interface CampaignProgress {
  isRunning: boolean;
  category: string;
  tab_name: string;
  total: number;
  current: number;
  sentCount: number;
  failedCount: number;
  currentBusinessName: string;
  statusText: string;
  log: { business_name: string; phone: string; status: 'sent' | 'failed' | 'skipped'; reason?: string; time: string }[];
}

let activeCampaign: CampaignProgress = {
  isRunning: false,
  category: '',
  tab_name: '',
  total: 0,
  current: 0,
  sentCount: 0,
  failedCount: 0,
  currentBusinessName: '',
  statusText: 'Idle',
  log: [],
};

let abortCampaignFlag = false;

export function getCampaignStatus(): CampaignProgress {
  return activeCampaign;
}

export function stopCampaign(): void {
  abortCampaignFlag = true;
  activeCampaign.statusText = 'Stopping campaign...';
}

const DEFAULT_WPP_SECRET = process.env.WPP_SECRET_KEY || 'your-wpp-secret-key';
let cachedTokens: Record<string, string> = {};

export async function getWppSessionToken(
  baseUrl: string,
  sessionName = 'leads-hunter',
  secretKey = DEFAULT_WPP_SECRET,
  forceRefresh = false
): Promise<string> {
  if (!forceRefresh && cachedTokens[sessionName]) {
    return cachedTokens[sessionName];
  }

  try {
    const encodedKey = encodeURIComponent(secretKey);
    const res = await fetch(`${baseUrl}/api/${sessionName}/${encodedKey}/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.token) {
        cachedTokens[sessionName] = data.token;
        return data.token;
      }
    }
  } catch (err) {
    // ignore
  }
  return '';
}

export interface WppStatusResult {
  isOnline: boolean;
  status: string; // 'CONNECTED' | 'QRCODE' | 'DISCONNECTED' | 'OFFLINE'
  phone?: string;
  qrcode?: string; // base64 data url
  error?: string;
}

export async function checkWppConnection(
  wppUrl: string,
  sessionName = 'leads-hunter',
  secretKey = DEFAULT_WPP_SECRET
): Promise<WppStatusResult> {
  const baseUrl = wppUrl.replace(/\/$/, '');
  try {
    const token = await getWppSessionToken(baseUrl, sessionName, secretKey);
    const res = await fetch(`${baseUrl}/api/${sessionName}/status-session`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const status = data.status || (data.connected ? 'CONNECTED' : 'DISCONNECTED');
      let qrcode: string | undefined = data.qrcode;

      if (!qrcode && (status === 'QRCODE' || !data.connected)) {
        try {
          const qrRes = await fetch(`${baseUrl}/api/${sessionName}/qrcode-session`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (qrRes.ok) {
            const contentType = qrRes.headers.get('content-type') || '';
            if (contentType.includes('image')) {
              const arrayBuffer = await qrRes.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              qrcode = `data:image/png;base64,${base64}`;
            } else {
              const qrText = await qrRes.text();
              try {
                const qrJson = JSON.parse(qrText);
                qrcode = qrJson.qrcode || qrJson.urlcode;
              } catch {}
            }
          }
        } catch {}
      }

      if (qrcode && !qrcode.startsWith('data:') && !qrcode.startsWith('http')) {
        qrcode = `data:image/png;base64,${qrcode}`;
      }

      return {
        isOnline: true,
        status,
        phone: data.phone,
        qrcode,
      };
    } else if (res.status === 404 || res.status === 401) {
      return {
        isOnline: true,
        status: 'DISCONNECTED',
        error: 'Session not started yet',
      };
    }
    return {
      isOnline: false,
      status: 'OFFLINE',
    };
  } catch (err: any) {
    return {
      isOnline: false,
      status: 'OFFLINE',
      error: err.message,
    };
  }
}

export async function startWppSession(
  wppUrl: string,
  sessionName = 'leads-hunter',
  secretKey = DEFAULT_WPP_SECRET
): Promise<{ success: boolean; status?: string; qrcode?: string; error?: string }> {
  const baseUrl = wppUrl.replace(/\/$/, '');
  try {
    const token = await getWppSessionToken(baseUrl, sessionName, secretKey);
    const res = await fetch(`${baseUrl}/api/${sessionName}/start-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ waitQrCode: true }),
    });

    const data = (await res.json()) as any;
    let qrcode = data.qrcode;
    if (!qrcode) {
      const statusRes = await checkWppConnection(wppUrl, sessionName, secretKey);
      qrcode = statusRes.qrcode;
    }
    if (qrcode && !qrcode.startsWith('data:') && !qrcode.startsWith('http')) {
      qrcode = `data:image/png;base64,${qrcode}`;
    }

    return {
      success: true,
      status: data.status,
      qrcode,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function logoutWppSession(
  wppUrl: string,
  sessionName = 'leads-hunter',
  secretKey = DEFAULT_WPP_SECRET
): Promise<{ success: boolean; message: string }> {
  const baseUrl = wppUrl.replace(/\/$/, '');
  try {
    const token = await getWppSessionToken(baseUrl, sessionName, secretKey);

    // 1. Tell WPPConnect to log out the WhatsApp account
    try {
      await fetch(`${baseUrl}/api/${sessionName}/logout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {}

    // 2. Clear session data on WPPConnect so it resets completely
    try {
      const encodedKey = encodeURIComponent(secretKey);
      await fetch(`${baseUrl}/api/${sessionName}/${encodedKey}/clear-session-data`, {
        method: 'POST',
      });
    } catch {}

    // 3. Clear cached token
    delete cachedTokens[sessionName];

    return { success: true, message: 'Session disconnected and logged out successfully.' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Box-Muller Gaussian / Normal distribution random number generator
 * Produces realistic bell-curve human delays centered around mean
 */
function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
  const result = Math.round(mean + z * stdDev);
  return Math.max(Math.round(mean * 0.4), result);
}

/**
 * Spintax generator: transforms {greeting 1|greeting 2|greeting 3} into one random option
 */
function applySpintax(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (match, group) => {
    if (group.includes('|')) {
      const choices = group.split('|');
      const pick = choices[Math.floor(Math.random() * choices.length)];
      return pick.trim();
    }
    return match;
  });
}

/**
 * Content variator: inserts zero-width spaces in ~12% of whitespaces
 * Creates subtle cryptographic uniqueness preventing spam hash matching without altering visual appearance
 */
function injectSubtleEntropy(text: string): string {
  const zwsp = '\u200B';
  return text.replace(/ /g, (space) => (Math.random() < 0.12 ? space + zwsp : space));
}

/**
 * Dispatches WhatsApp messages to a list of leads using WPPConnect
 */
export async function startWhatsAppCampaign(
  leads: any[],
  category: string,
  tabName: string,
  wppconnectUrl: string,
  googleSheetWebhookUrl: string,
  delaySeconds: number = 45,
  jitterSeconds: number = 20,
  sessionName: string = 'leads-hunter',
  customMessage?: string,
  antiBanConfig?: AntiBanConfig
): Promise<{ success: boolean; message: string }> {
  if (activeCampaign.isRunning) {
    return { success: false, message: 'A campaign is already currently running.' };
  }

  const dailyCap = antiBanConfig?.dailyCap !== undefined ? antiBanConfig.dailyCap : 40;
  if (dailyCap > 0) {
    const stats = DailyLogModel.getDailyStats();
    if (stats.sent_today >= dailyCap) {
      return {
        success: false,
        message: `🛑 Anti-Ban Daily Cap reached (${stats.sent_today}/${dailyCap} sent today). Campaign safely prevented from starting. Increase cap in Settings or click 'Reset Today'.`,
      };
    }
  }

  abortCampaignFlag = false;
  const templates = loadTemplates();
  const catKey = (category || 'cafes').toLowerCase();
  const templateObj = templates[catKey] || templates['cafes'] || {
    template: 'مرحباً {business_name} 👋 لدينا عرض خاص بكم في {zone}. هل يمكننا مشاركة التفاصيل مع الإدارة؟',
  };

  // Deduplicate target leads by phone to prevent multiple messages to the same phone
  const seenCampaignPhones = new Set<string>();
  const deduplicatedLeads: any[] = [];
  for (const lead of leads) {
    if (!lead) continue;
    const rawVal = lead.wpp_phone ?? lead.phone_number ?? lead.phone ?? '';
    const phoneInfo = cleanJordanianPhone(rawVal);
    const phoneKey = phoneInfo.formattedPhone || String(rawVal).replace(/\D/g, '');
    if (phoneKey) {
      if (seenCampaignPhones.has(phoneKey)) continue;
      seenCampaignPhones.add(phoneKey);
    }
    deduplicatedLeads.push(lead);
  }

  activeCampaign = {
    isRunning: true,
    category,
    tab_name: tabName,
    total: deduplicatedLeads.length,
    current: 0,
    sentCount: 0,
    failedCount: 0,
    currentBusinessName: '',
    statusText: `Starting campaign for ${deduplicatedLeads.length} leads...`,
    log: [],
  };

  // Run asynchronously in background
  (async () => {
    try {
      for (let i = 0; i < deduplicatedLeads.length; i++) {
        if (abortCampaignFlag) {
          activeCampaign.statusText = 'Campaign aborted by user.';
          break;
        }

        // 1. Anti-Ban Daily Cap Check
        const dailyCap = antiBanConfig?.dailyCap !== undefined ? antiBanConfig.dailyCap : 40;
        if (dailyCap > 0) {
          const stats = DailyLogModel.getDailyStats();
          if (stats.sent_today >= dailyCap) {
            activeCampaign.statusText = `🛡️ Anti-Ban Daily Cap reached (${stats.sent_today}/${dailyCap} sent today). Campaign safely stopped.`;
            console.log(`[outreach] Anti-Ban Daily Cap reached: ${stats.sent_today}/${dailyCap}. Halting campaign.`);
            break;
          }
        }

        // 2. Safe Time-of-Day Window Check
        const windowStart = antiBanConfig?.sendWindowStart !== undefined ? antiBanConfig.sendWindowStart : 9;
        const windowEnd = antiBanConfig?.sendWindowEnd !== undefined ? antiBanConfig.sendWindowEnd : 20;
        if (windowStart < windowEnd) {
          let currentHour = new Date().getHours();
          if (currentHour < windowStart || currentHour >= windowEnd) {
            activeCampaign.statusText = `⏰ Outside safe sending window (${windowStart}:00 - ${windowEnd}:00). Pausing campaign...`;
            while (!abortCampaignFlag) {
              currentHour = new Date().getHours();
              if (currentHour >= windowStart && currentHour < windowEnd) break;
              await new Promise(r => setTimeout(r, 15000));
            }
            if (abortCampaignFlag) break;
          }
        }

        const lead = deduplicatedLeads[i];
        activeCampaign.current = i + 1;
        let messageSentSuccessfully = false;
        const rawPhone = lead.phone_number ?? lead.phone ?? lead.wpp_phone ?? '';
        const phoneValidation = cleanJordanianPhone(rawPhone);

        // 3. Skip if not a valid mobile
        if (!phoneValidation.isValidMobile || !phoneValidation.wppPhone) {
          activeCampaign.log.unshift({
            business_name: String(lead.business_name || 'Unknown Business'),
            phone: String(rawPhone || 'None'),
            status: 'skipped',
            reason: phoneValidation.reason,
            time: new Date().toLocaleTimeString(),
          });
          continue;
        }

        // 4. Render personalized message with Spintax & Entropy
        const rawTemplate = (customMessage && customMessage.trim().length > 0)
          ? customMessage.trim()
          : templateObj.template;

        let message = rawTemplate
          .replace(/\{business_name\}/g, String(lead.business_name || ''))
          .replace(/\{zone\}/g, String(lead.zone || lead.address || ''))
          .replace(/\{rating\}/g, String(lead.rating ?? '4.5'))
          .replace(/\{reviews_count\}/g, String(lead.reviews_count ?? ''))
          .replace(/\{category\}/g, String(lead.category || category || ''))
          .replace(/\{phone_number\}/g, String(phoneValidation.formattedPhone || ''));

        if (antiBanConfig?.enableVariation !== false) {
          message = applySpintax(message);
          message = injectSubtleEntropy(message);
        }

        // 5. Light typing simulation delay (~10ms/char, between 800ms and 1800ms max)
        const typingMs = Math.min(Math.max(800, Math.round(message.length * 10)), 1800);
        activeCampaign.statusText = `Preparing message for ${String(lead.business_name || 'business')}...`;
        await new Promise(r => setTimeout(r, typingMs));

        if (abortCampaignFlag) break;

        activeCampaign.statusText = `Sending to ${String(lead.business_name || 'business')} (${phoneValidation.formattedPhone})...`;

        // 6. Send via WPPConnect API
        try {
          const secretKey = DEFAULT_WPP_SECRET;
          const baseUrl = wppconnectUrl.replace(/\/$/, '');

          // Ensure session token is available (with retries)
          let token = await getWppSessionToken(baseUrl, sessionName, secretKey);
          if (!token) {
            for (let t = 0; t < 2; t++) {
              await new Promise(r => setTimeout(r, 1000));
              token = await getWppSessionToken(baseUrl, sessionName, secretKey, true);
              if (token) break;
            }
          }

          // Prepare phone recipient (e.g. 962791234567)
          const recipientPhone = phoneValidation.wppPhone;

          // Attempt send via official WPPConnect /api/:session/send-message
          const sendEndpoint = `${baseUrl}/api/${sessionName}/send-message`;
          let res = await fetch(sendEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              phone: recipientPhone,
              message,
            }),
          });

          // If 401 Unauthorized, automatically force-refresh token and retry once!
          if (res.status === 401) {
            console.log(`[outreach] Received 401 for ${lead.business_name}, refreshing WPP token and retrying...`);
            token = await getWppSessionToken(baseUrl, sessionName, secretKey, true);
            res = await fetch(sendEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                phone: recipientPhone,
                message,
              }),
            });
          }

          // Fallback attempt without session prefix if custom proxy
          if (res.status === 404) {
            const fallbackEndpoint = `${baseUrl}/api/v2/send-message`;
            res = await fetch(fallbackEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                phone: recipientPhone,
                message,
              }),
            });
          }

          if (res.ok) {
            messageSentSuccessfully = true;
            activeCampaign.sentCount++;
            DailyLogModel.increment();

            activeCampaign.log.unshift({
              business_name: String(lead.business_name || 'Unknown Business'),
              phone: phoneValidation.formattedPhone!,
              status: 'sent',
              time: new Date().toLocaleTimeString(),
            });

            // Update Google Sheet status to 'Sent' if webhook is configured
            if (googleSheetWebhookUrl) {
              const updated = await updateLeadStatusInSheet(
                googleSheetWebhookUrl,
                tabName,
                String(lead.place_id || ''),
                phoneValidation.formattedPhone!,
                'Sent',
                new Date().toISOString()
              );
              console.log(`[outreach] Sheet status updated to 'Sent' for ${String(lead.business_name || 'business')} (${phoneValidation.formattedPhone}) in tab '${tabName}': ${updated}`);
            }

            // 7. Batch Cooldown every N messages
            const cooldownEvery = antiBanConfig?.batchCooldownEvery !== undefined ? antiBanConfig.batchCooldownEvery : 15;
            if (cooldownEvery > 0 && activeCampaign.sentCount > 0 && activeCampaign.sentCount % cooldownEvery === 0 && i < deduplicatedLeads.length - 1 && !abortCampaignFlag) {
              const minCd = Math.max(30, antiBanConfig?.batchCooldownMinSeconds ?? 180);
              const maxCd = Math.max(minCd, antiBanConfig?.batchCooldownMaxSeconds ?? 420);
              const cooldownSec = Math.floor(Math.random() * (maxCd - minCd + 1)) + minCd;
              for (let sec = cooldownSec; sec > 0; sec--) {
                if (abortCampaignFlag) break;
                const mins = Math.floor(sec / 60);
                const s = sec % 60;
                activeCampaign.statusText = `🛑 Batch cooldown: taking a human break (${mins}m ${s}s remaining after ${activeCampaign.sentCount} msgs)...`;
                await new Promise(r => setTimeout(r, 1000));
              }
            }
          } else {
            messageSentSuccessfully = false;
            const errText = await res.text();
            activeCampaign.failedCount++;

            let friendlyReason = `WPPConnect error: ${res.status} ${errText.slice(0, 100)}`;
            let isNotOnWhatsApp = false;

            if (errText.includes('não existe') || errText.includes('not exist') || errText.includes('is not registered')) {
              friendlyReason = 'Number not registered on WhatsApp';
              isNotOnWhatsApp = true;
            } else if (res.status === 401 || errText.includes('Token')) {
              friendlyReason = 'Authentication failed (401)';
            } else if (errText.includes('463') || errText.includes('timelock') || errText.includes('reach-out')) {
              friendlyReason = 'WhatsApp Error 463: Reach-out timelock. Halted to prevent ban.';
              activeCampaign.statusText = '🛑 WhatsApp reach-out timelock detected (463). Campaign halted immediately for safety!';
              abortCampaignFlag = true;
            }

            activeCampaign.log.unshift({
              business_name: String(lead.business_name || 'Unknown Business'),
              phone: phoneValidation.formattedPhone!,
              status: 'failed',
              reason: friendlyReason,
              time: new Date().toLocaleTimeString(),
            });

            // If number doesn't have WhatsApp, flag it as 'Invalid Phone' in Google Sheet
            if (isNotOnWhatsApp && googleSheetWebhookUrl) {
              await updateLeadStatusInSheet(
                googleSheetWebhookUrl,
                tabName,
                String(lead.place_id || ''),
                phoneValidation.formattedPhone!,
                'Invalid Phone',
                new Date().toISOString()
              );
              console.log(`[outreach] Number not on WhatsApp. Sheet updated to 'Invalid Phone' for ${String(lead.business_name || 'business')} (${phoneValidation.formattedPhone})`);
            }
          }
        } catch (sendErr: any) {
          messageSentSuccessfully = false;
          activeCampaign.failedCount++;
          activeCampaign.log.unshift({
            business_name: String(lead.business_name || 'Unknown Business'),
            phone: phoneValidation.formattedPhone!,
            status: 'failed',
            reason: sendErr.message || 'Connection error',
            time: new Date().toLocaleTimeString(),
          });
        }

        // 8. Human Delay before next message (ONLY triggers if a message was successfully sent)
        if (i < deduplicatedLeads.length - 1 && !abortCampaignFlag) {
          if (messageSentSuccessfully) {
            const waitSeconds = Math.max(8, gaussianRandom(delaySeconds, Math.max(2, Math.floor(jitterSeconds / 2))));
            for (let sec = waitSeconds; sec > 0; sec--) {
              if (abortCampaignFlag) break;
              activeCampaign.statusText = `Waiting ${sec}s before next message (Anti-Ban Gaussian safety)...`;
              await new Promise((r) => setTimeout(r, 1000));
            }
          } else {
            // Failed send or number not on WhatsApp: skip directly to next number immediately!
            activeCampaign.statusText = `Send failed / not on WhatsApp: skipping directly to next lead...`;
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }
    } finally {
      activeCampaign.isRunning = false;
      if (!abortCampaignFlag) {
        activeCampaign.statusText = `Campaign completed: ${activeCampaign.sentCount} sent, ${activeCampaign.failedCount} failed.`;
      }
    }
  })();

  return { success: true, message: `Campaign launched for ${leads.length} leads.` };
}

