import { handleUpload } from '@vercel/blob/client';
import { store, getRaw, findTeamByCred, bad, J } from './_lib.js';

// Vercel Blob client-upload handshake for pitch PDFs (bypasses the 4.5MB function body limit)
export default async function handler(req, res) {
  if (req.method !== 'POST') return bad(res, 'POST only', 405);
  try {
    const json = await handleUpload({
      body: typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}'),
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const cred = J(clientPayload, {});
        const s = await store();
        const team = findTeamByCred((await getRaw(s)).teams, cred);
        if (!team) throw new Error('등록된 팀 이메일이 아니에요.');
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 30 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ team: team.id }),
        };
      },
      onUploadCompleted: async () => {},
    });
    res.status(200).json(json);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}
