// api/track.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { eventId, eventName, customData = {}, userData = {} } = req.body;

  if (!eventName) {
    return res.status(400).json({ error: 'eventName is required' });
  }

  const PIXEL_ID = process.env.META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.error('Missing environment variables: META_PIXEL_ID, META_ACCESS_TOKEN');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const referer = req.headers.referer || '';
  const fbclid = req.query.fbclid || '';

  const eventPayload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId || `${eventName}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        action_source: 'website',
        user_data: {
          client_ip_address: clientIp,
          client_user_agent: userAgent,
          fbp: userData.fbp || '',
          fbc: userData.fbc || ''
        },
        custom_data: {
          ...customData,
          fbclid: fbclid,
          referer: referer
        }
      }
    ],
    access_token: ACCESS_TOKEN
  };

  const graphUrl = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events`;

  try {
    const response = await fetch(graphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload)
    });

    const result = await response.json();

    console.log('=== CAPI EVENT SENT ===');
    console.log(JSON.stringify({
      eventId: eventPayload.data[0].event_id,
      eventName: eventName,
      status: response.status,
      statusText: response.statusText,
      fbResponse: result,
      timestamp: new Date().toISOString(),
      ip: clientIp,
      userAgent: userAgent,
      hasFbp: !!userData.fbp,
      hasFbc: !!userData.fbc,
      customSource: customData.source || 'none'
    }, null, 2));

    if (!response.ok) {
      console.error('CAPI ERROR:', JSON.stringify(result, null, 2));
      return res.status(response.status).json({ error: result });
    }

    return res.status(200).json({ success: true, fbResponse: result });
  } catch (error) {
    console.error('CAPI EXCEPTION:', error.message);
    console.error(error.stack);
    return res.status(500).json({ error: error.message });
  }
}
