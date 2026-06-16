// Référence statique de l'API Dyper : structure typée pilotant la page /api-docs.
// Les descriptions sont des clés i18n ; les exemples de code sont générés par buildSamples()
// afin que curl / JavaScript / Python ne divergent jamais.

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
// 'apiKey' : accès programmatique via `Authorization: Bearer dyk_live_…` (ou, depuis le web, la
// session). 'appKey+session' : X-App-Key + cookie de session (usage web). 'appKey' : X-App-Key seul
// (auth). 'session' : cookie seul (médias). 'none' : public.
export type AuthKind = 'apiKey' | 'appKey' | 'appKey+session' | 'session' | 'none'
export type ParamsKind = 'body' | 'query' | 'multipart'

export interface ApiParam {
  name: string
  type: string
  required: boolean
  descKey: string
}

export interface ApiEndpoint {
  id: string
  method: HttpMethod
  path: string
  descKey: string
  auth: AuthKind
  paramsKind?: ParamsKind
  params?: ApiParam[]
  responseExample: string
  sse?: boolean
}

export interface ApiSection {
  id: string
  titleKey: string
  introKey?: string
  endpoints: ApiEndpoint[]
}

const json = (value: unknown): string => JSON.stringify(value, null, 2)

export const API_SECTIONS: ApiSection[] = [
  {
    id: 'auth',
    titleKey: 'docs.section.auth.title',
    introKey: 'docs.auth.intro',
    endpoints: [
      {
        id: 'register',
        method: 'POST',
        path: '/api/v1/auth/register',
        descKey: 'docs.ep.register.desc',
        auth: 'appKey',
        paramsKind: 'body',
        params: [
          { name: 'email', type: 'string', required: true, descKey: 'docs.p.email' },
          { name: 'password', type: 'string (≥ 8)', required: true, descKey: 'docs.p.password' },
          { name: 'displayName', type: 'string', required: false, descKey: 'docs.p.displayName' },
        ],
        responseExample: json({
          success: true,
          user: { id: 'uuid', email: 'vous@exemple.fr', displayName: 'Vous' },
        }),
      },
      {
        id: 'login',
        method: 'POST',
        path: '/api/v1/auth/login',
        descKey: 'docs.ep.login.desc',
        auth: 'appKey',
        paramsKind: 'body',
        params: [
          { name: 'email', type: 'string', required: true, descKey: 'docs.p.email' },
          { name: 'password', type: 'string', required: true, descKey: 'docs.p.password' },
        ],
        responseExample: json({ success: true, user: { id: 'uuid', email: 'vous@exemple.fr' } }),
      },
      {
        id: 'logout',
        method: 'POST',
        path: '/api/v1/auth/logout',
        descKey: 'docs.ep.logout.desc',
        auth: 'appKey',
        responseExample: json({ success: true }),
      },
    ],
  },
  {
    id: 'analyze',
    titleKey: 'docs.section.analyze.title',
    endpoints: [
      {
        id: 'analyzeFile',
        method: 'POST',
        path: '/api/v1/analyze',
        descKey: 'docs.ep.analyzeFile.desc',
        auth: 'apiKey',
        paramsKind: 'multipart',
        params: [
          { name: 'file', type: 'fichier', required: true, descKey: 'docs.p.file' },
          { name: 'prompt', type: 'string', required: false, descKey: 'docs.p.prompt' },
          { name: 'lang', type: '"fr" | "en"', required: false, descKey: 'docs.p.lang' },
        ],
        responseExample: json({
          success: true,
          requestId: 'uuid',
          processingTime: 412,
          result: {
            description: 'L’image montre une personne et une voiture.',
            visualization: {
              objects: [{ label: 'person', confidence: 0.92, boundingBox: { x: 10, y: 20, w: 110, h: 220 } }],
              scene: { label: 'rue / circulation urbaine', confidence: 0.7, indoor: false },
              colors: ['#1A2B3C', '#888888', '#F0F0F0'],
              text: [],
              tags: ['car', 'person'],
            },
            model: 'yolo26l',
            timeline: null,
            sourceWidth: 1280,
            sourceHeight: 720,
            audioTranscript: null,
            lang: 'fr',
          },
        }),
      },
      {
        id: 'analyzeUrl',
        method: 'POST',
        path: '/api/v1/analyze/url',
        descKey: 'docs.ep.analyzeUrl.desc',
        auth: 'apiKey',
        paramsKind: 'body',
        params: [
          { name: 'url', type: 'string (http/https)', required: true, descKey: 'docs.p.url' },
          { name: 'prompt', type: 'string', required: false, descKey: 'docs.p.prompt' },
          { name: 'lang', type: '"fr" | "en"', required: false, descKey: 'docs.p.lang' },
        ],
        responseExample: json({ success: true, requestId: 'uuid', result: '…' }),
      },
      {
        id: 'analyzePrompt',
        method: 'POST',
        path: '/api/v1/analyze/prompt',
        descKey: 'docs.ep.analyzePrompt.desc',
        auth: 'apiKey',
        paramsKind: 'body',
        params: [
          { name: 'prompt', type: 'string', required: true, descKey: 'docs.p.promptOnly' },
          { name: 'lang', type: '"fr" | "en"', required: false, descKey: 'docs.p.lang' },
        ],
        responseExample: json({ success: true, requestId: 'uuid', result: '…' }),
      },
    ],
  },
  {
    id: 'conversations',
    titleKey: 'docs.section.conversations.title',
    introKey: 'docs.section.conversations.intro',
    endpoints: [
      {
        id: 'listConversations',
        method: 'GET',
        path: '/api/v1/conversations',
        descKey: 'docs.ep.listConversations.desc',
        auth: 'appKey+session',
        paramsKind: 'query',
        params: [
          { name: 'page', type: 'integer', required: false, descKey: 'docs.p.page' },
          { name: 'limit', type: 'integer (≤ 200)', required: false, descKey: 'docs.p.limit' },
        ],
        responseExample: json({
          success: true,
          data: [{ id: 'uuid', title: 'Analyse de la plage', updatedAt: '2026-06-10T12:00:00Z' }],
          total: 1,
        }),
      },
      {
        id: 'createConversation',
        method: 'POST',
        path: '/api/v1/conversations',
        descKey: 'docs.ep.createConversation.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [{ name: 'title', type: 'string (≤ 120)', required: false, descKey: 'docs.p.title' }],
        responseExample: json({ success: true, conversation: { id: 'uuid', title: 'Nouvelle conversation' } }),
      },
      {
        id: 'getConversation',
        method: 'GET',
        path: '/api/v1/conversations/:id',
        descKey: 'docs.ep.getConversation.desc',
        auth: 'appKey+session',
        responseExample: json({
          success: true,
          conversation: { id: 'uuid', title: '…' },
          messages: [
            { id: 'uuid', role: 'user', kind: 'text', content: 'Que vois-tu ?', status: 'ready', seq: 1 },
            {
              id: 'uuid',
              role: 'assistant',
              kind: 'analysis',
              status: 'ready',
              seq: 2,
              analysis: { requestId: 'uuid', description: '…', thumbnailUrl: '/api/v1/media/uuid' },
            },
          ],
        }),
      },
      {
        id: 'renameConversation',
        method: 'PATCH',
        path: '/api/v1/conversations/:id',
        descKey: 'docs.ep.renameConversation.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [{ name: 'title', type: 'string (1–120)', required: true, descKey: 'docs.p.title' }],
        responseExample: json({ success: true, conversation: { id: 'uuid', title: 'Nouveau titre' } }),
      },
      {
        id: 'deleteConversation',
        method: 'DELETE',
        path: '/api/v1/conversations/:id',
        descKey: 'docs.ep.deleteConversation.desc',
        auth: 'appKey+session',
        responseExample: json({ success: true }),
      },
      {
        id: 'postMessage',
        method: 'POST',
        path: '/api/v1/conversations/:id/messages',
        descKey: 'docs.ep.postMessage.desc',
        auth: 'appKey+session',
        paramsKind: 'multipart',
        params: [
          { name: 'file', type: 'fichier', required: false, descKey: 'docs.p.file' },
          { name: 'text', type: 'string', required: false, descKey: 'docs.p.text' },
          { name: 'url', type: 'string', required: false, descKey: 'docs.p.url' },
          { name: 'lang', type: '"fr" | "en"', required: false, descKey: 'docs.p.lang' },
        ],
        responseExample: json({
          success: true,
          conversation: { id: 'uuid', title: '…' },
          messages: [
            { id: 'uuid', role: 'user', kind: 'text', content: 'Que vois-tu ?', status: 'ready', seq: 1 },
            { id: 'uuid', role: 'assistant', kind: 'analysis', status: 'queued', analysis: null, seq: 2 },
          ],
        }),
      },
      {
        id: 'cancelMessage',
        method: 'POST',
        path: '/api/v1/conversations/:id/cancel',
        descKey: 'docs.ep.cancelMessage.desc',
        auth: 'appKey+session',
        responseExample: json({ success: true, cancelled: true }),
      },
      {
        id: 'streamMessage',
        method: 'POST',
        path: '/api/v1/conversations/:id/messages/stream',
        descKey: 'docs.ep.streamMessage.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        sse: true,
        params: [
          { name: 'text', type: 'string (1–1000)', required: true, descKey: 'docs.p.question' },
          { name: 'lang', type: '"fr" | "en"', required: false, descKey: 'docs.p.lang' },
        ],
        responseExample: [
          'data: {"delta":"Une "}',
          '',
          'data: {"delta":"personne."}',
          '',
          'event: done',
          'data: {"messageId":"uuid","conversationId":"uuid"}',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'history',
    titleKey: 'docs.section.history.title',
    endpoints: [
      {
        id: 'listAnalyses',
        method: 'GET',
        path: '/api/v1/analyses',
        descKey: 'docs.ep.listAnalyses.desc',
        auth: 'apiKey',
        paramsKind: 'query',
        params: [
          { name: 'page', type: 'integer', required: false, descKey: 'docs.p.page' },
          { name: 'limit', type: 'integer (≤ 200)', required: false, descKey: 'docs.p.limit' },
          { name: 'type', type: '"image" | "video" | "prompt"', required: false, descKey: 'docs.p.type' },
          { name: 'sort_by', type: 'string', required: false, descKey: 'docs.p.sortBy' },
          { name: 'sort_order', type: '"asc" | "desc"', required: false, descKey: 'docs.p.sortOrder' },
        ],
        responseExample: json({ data: ['…'], total: 12, page: 1, limit: 50 }),
      },
      {
        id: 'getAnalysis',
        method: 'GET',
        path: '/api/v1/analyses/:id',
        descKey: 'docs.ep.getAnalysis.desc',
        auth: 'apiKey',
        responseExample: json({ data: { id: 'uuid', description: '…', timeline: '…' } }),
      },
      {
        id: 'deleteAnalysis',
        method: 'DELETE',
        path: '/api/v1/analyses/:id',
        descKey: 'docs.ep.deleteAnalysis.desc',
        auth: 'apiKey',
        responseExample: json({ success: true, deleted: 1 }),
      },
      {
        id: 'getChatHistory',
        method: 'GET',
        path: '/api/v1/analyses/:requestId/chat',
        descKey: 'docs.ep.getChatHistory.desc',
        auth: 'apiKey',
        responseExample: json({ data: [{ question: '…', answer: '…' }], total: 1 }),
      },
    ],
  },
  {
    id: 'media',
    titleKey: 'docs.section.media.title',
    introKey: 'docs.section.media.intro',
    endpoints: [
      {
        id: 'getMedia',
        method: 'GET',
        path: '/api/v1/media/:requestId',
        descKey: 'docs.ep.getMedia.desc',
        auth: 'session',
        responseExample: 'image/jpeg (binaire)',
      },
      {
        id: 'getMediaVideo',
        method: 'GET',
        path: '/api/v1/media/:requestId/video',
        descKey: 'docs.ep.getMediaVideo.desc',
        auth: 'session',
        responseExample: 'video/mp4 (binaire — 206 Partial Content avec un en-tête Range)',
      },
    ],
  },
  {
    id: 'account',
    titleKey: 'docs.section.account.title',
    endpoints: [
      {
        id: 'getMe',
        method: 'GET',
        path: '/api/v1/me',
        descKey: 'docs.ep.getMe.desc',
        auth: 'appKey+session',
        responseExample: json({
          success: true,
          user: { id: 'uuid', email: 'vous@exemple.fr' },
          settings: { appearance: { theme: 'system' }, analysis: { defaultLang: 'fr' } },
        }),
      },
      {
        id: 'updateProfile',
        method: 'PATCH',
        path: '/api/v1/me/profile',
        descKey: 'docs.ep.updateProfile.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [
          { name: 'displayName', type: 'string (≤ 80)', required: false, descKey: 'docs.p.displayName' },
          { name: 'avatarUrl', type: 'string (≤ 2048)', required: false, descKey: 'docs.p.avatarUrl' },
          { name: 'bio', type: 'string (≤ 500)', required: false, descKey: 'docs.p.bio' },
        ],
        responseExample: json({ success: true, user: { id: 'uuid', displayName: 'Vous' } }),
      },
      {
        id: 'changePassword',
        method: 'PATCH',
        path: '/api/v1/me/password',
        descKey: 'docs.ep.changePassword.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [
          { name: 'currentPassword', type: 'string', required: true, descKey: 'docs.p.currentPassword' },
          { name: 'newPassword', type: 'string (≥ 8)', required: true, descKey: 'docs.p.newPassword' },
        ],
        responseExample: json({ success: true }),
      },
      {
        id: 'getSessions',
        method: 'GET',
        path: '/api/v1/me/sessions',
        descKey: 'docs.ep.getSessions.desc',
        auth: 'appKey+session',
        responseExample: json({
          success: true,
          sessions: [{ id: 'uuid', current: true, createdAt: '2026-06-10T12:00:00Z', lastSeenAt: '2026-06-17T09:00:00Z' }],
        }),
      },
      {
        id: 'revokeSessions',
        method: 'POST',
        path: '/api/v1/me/sessions/revoke-all',
        descKey: 'docs.ep.revokeSessions.desc',
        auth: 'appKey+session',
        responseExample: json({ success: true }),
      },
      {
        id: 'updateSettings',
        method: 'PUT',
        path: '/api/v1/me/settings',
        descKey: 'docs.ep.updateSettings.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [
          { name: 'appearance', type: 'object', required: false, descKey: 'docs.p.appearance' },
          { name: 'analysis', type: 'object', required: false, descKey: 'docs.p.analysis' },
        ],
        responseExample: json({ success: true, settings: '…' }),
      },
      {
        id: 'exportData',
        method: 'GET',
        path: '/api/v1/me/export',
        descKey: 'docs.ep.exportData.desc',
        auth: 'appKey+session',
        responseExample: json({ user: '…', analyses: ['…'], conversations: ['…'] }),
      },
      {
        id: 'purgeHistory',
        method: 'DELETE',
        path: '/api/v1/me/history',
        descKey: 'docs.ep.purgeHistory.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [
          { name: 'type', type: '"image" | "video" | "prompt"', required: false, descKey: 'docs.p.type' },
        ],
        responseExample: json({ success: true, deleted: 12 }),
      },
      {
        id: 'deleteAccount',
        method: 'DELETE',
        path: '/api/v1/me/account',
        descKey: 'docs.ep.deleteAccount.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [{ name: 'password', type: 'string', required: true, descKey: 'docs.p.password' }],
        responseExample: json({ success: true }),
      },
    ],
  },
  {
    id: 'subscription',
    titleKey: 'docs.section.subscription.title',
    introKey: 'docs.subscription.intro',
    endpoints: [
      {
        id: 'getPlan',
        method: 'GET',
        path: '/api/v1/me/plan',
        descKey: 'docs.ep.getPlan.desc',
        auth: 'appKey+session',
        responseExample: json({
          success: true,
          plan: 'free',
          limits: {
            monthlyAnalyses: 40,
            monthlyVideoMinutes: 10,
            maxImageMb: 10,
            maxVideoMb: 30,
            queuePriority: 0,
          },
        }),
      },
      {
        id: 'getUsage',
        method: 'GET',
        path: '/api/v1/me/usage',
        descKey: 'docs.ep.getUsage.desc',
        auth: 'appKey+session',
        responseExample: json({
          success: true,
          plan: 'free',
          limits: { monthlyAnalyses: 40, monthlyVideoMinutes: 10 },
          usage: { analyses: 7, videoMinutes: 2.5 },
          periodStart: '2026-06-01T00:00:00.000Z',
          resetsAt: '2026-07-01T00:00:00.000Z',
        }),
      },
      {
        id: 'checkout',
        method: 'POST',
        path: '/api/v1/me/checkout',
        descKey: 'docs.ep.checkout.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [
          { name: 'plan', type: '"free" | "pro" | "studio"', required: true, descKey: 'docs.p.plan' },
        ],
        responseExample: json({
          success: true,
          plan: 'pro',
          limits: { monthlyAnalyses: 400, monthlyVideoMinutes: 120 },
          receipt: { id: 'dyper_demo_uuid', paid: true, previousPlan: 'free' },
        }),
      },
      {
        id: 'getCapacity',
        method: 'GET',
        path: '/api/v1/me/capacity',
        descKey: 'docs.ep.getCapacity.desc',
        auth: 'appKey+session',
        responseExample: json({
          success: true,
          maxConcurrent: 2,
          active: 1,
          queued: 0,
          busy: false,
          avgAnalysisSeconds: 40,
        }),
      },
    ],
  },
  {
    id: 'apikeys',
    titleKey: 'docs.section.apikeys.title',
    introKey: 'docs.section.apikeys.intro',
    endpoints: [
      {
        id: 'listApiKeys',
        method: 'GET',
        path: '/api/v1/me/api-keys',
        descKey: 'docs.ep.listApiKeys.desc',
        auth: 'appKey+session',
        responseExample: json({
          success: true,
          keys: [
            {
              id: 'uuid',
              name: 'Ma clé serveur',
              prefix: 'dyk_live_3f9a…',
              lastUsedAt: '2026-06-17T09:00:00Z',
              createdAt: '2026-06-10T12:00:00Z',
            },
          ],
        }),
      },
      {
        id: 'createApiKey',
        method: 'POST',
        path: '/api/v1/me/api-keys',
        descKey: 'docs.ep.createApiKey.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [{ name: 'name', type: 'string (≤ 80)', required: false, descKey: 'docs.p.keyName' }],
        responseExample: json({
          success: true,
          key: {
            id: 'uuid',
            name: 'Ma clé serveur',
            prefix: 'dyk_live_3f9a…',
            lastUsedAt: null,
            createdAt: '2026-06-17T09:00:00Z',
            secret: 'dyk_live_3f9a…(montré une seule fois)',
          },
        }),
      },
      {
        id: 'revokeApiKey',
        method: 'DELETE',
        path: '/api/v1/me/api-keys/:id',
        descKey: 'docs.ep.revokeApiKey.desc',
        auth: 'appKey+session',
        responseExample: json({ success: true }),
      },
      {
        id: 'getApiPlan',
        method: 'GET',
        path: '/api/v1/me/api-plan',
        descKey: 'docs.ep.getApiPlan.desc',
        auth: 'appKey+session',
        responseExample: json({
          success: true,
          plan: 'free',
          limits: {
            monthlyRequests: 100,
            maxImageMb: 10,
            maxVideoMb: 30,
            rateLimitPerMin: 10,
            queuePriority: 0,
          },
        }),
      },
      {
        id: 'getApiUsage',
        method: 'GET',
        path: '/api/v1/me/api-usage',
        descKey: 'docs.ep.getApiUsage.desc',
        auth: 'appKey+session',
        responseExample: json({
          success: true,
          plan: 'free',
          limits: { monthlyRequests: 100, rateLimitPerMin: 10 },
          usage: { requests: 12 },
          tokenBalance: 0,
          periodStart: '2026-06-01T00:00:00.000Z',
          resetsAt: '2026-07-01T00:00:00.000Z',
        }),
      },
      {
        id: 'apiCheckout',
        method: 'POST',
        path: '/api/v1/me/api-checkout',
        descKey: 'docs.ep.apiCheckout.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [
          {
            name: 'plan',
            type: '"free" | "starter" | "business" | "unlimited"',
            required: true,
            descKey: 'docs.p.apiPlan',
          },
        ],
        responseExample: json({
          success: true,
          plan: 'starter',
          limits: { monthlyRequests: 5000, rateLimitPerMin: 60 },
          receipt: { id: 'dyper_api_demo_uuid', paid: true, previousPlan: 'free' },
        }),
      },
      {
        id: 'buyApiTokens',
        method: 'POST',
        path: '/api/v1/me/api-tokens',
        descKey: 'docs.ep.buyApiTokens.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [
          { name: 'pack', type: '"small" | "medium" | "large"', required: true, descKey: 'docs.p.tokenPack' },
        ],
        responseExample: json({
          success: true,
          tokenBalance: 10000,
          receipt: { id: 'dyper_tokens_demo_uuid', pack: 'medium', tokens: 10000 },
        }),
      },
    ],
  },
  {
    id: 'health',
    titleKey: 'docs.section.health.title',
    endpoints: [
      {
        id: 'health',
        method: 'GET',
        path: '/health',
        descKey: 'docs.ep.health.desc',
        auth: 'none',
        responseExample: json({ status: 'ok', uptime: 1234.5, db: 'ok', ai: 'ok' }),
      },
    ],
  },
]

// Génère les trois exemples de code (curl / JavaScript / Python) d'un endpoint.
export function buildSamples(endpoint: ApiEndpoint): { curl: string; js: string; python: string } {
  const base = 'https://votre-instance:3000'
  const url = `${base}${endpoint.path}`
  // 'apiKey' : accès programmatique par clé API (Bearer) — ni X-App-Key ni cookie. Les autres
  // routes authentifiées s'utilisent depuis le web (X-App-Key + cookie de session).
  const isApiKey = endpoint.auth === 'apiKey'
  const needsAppKey = endpoint.auth === 'appKey' || endpoint.auth === 'appKey+session'
  const usesCookie = !isApiKey && endpoint.auth !== 'none'
  const bodyParams = endpoint.paramsKind === 'body' ? (endpoint.params ?? []) : []
  const bodyObject = Object.fromEntries(bodyParams.map((p) => [p.name, `<${p.name}>`]))
  const hasBody = bodyParams.length > 0
  const isMultipart = endpoint.paramsKind === 'multipart'

  const curlLines = [`curl -X ${endpoint.method} "${url}"`]
  if (isApiKey) curlLines.push('  -H "Authorization: Bearer $DYPER_API_KEY"')
  if (needsAppKey) curlLines.push('  -H "X-App-Key: $APP_KEY"')
  if (usesCookie) curlLines.push('  -b cookies.txt')
  if (isMultipart) {
    curlLines.push('  -F "file=@photo.jpg"')
    curlLines.push('  -F "text=Que vois-tu ?"')
  } else if (hasBody) {
    curlLines.push('  -H "Content-Type: application/json"')
    curlLines.push(`  -d '${JSON.stringify(bodyObject)}'`)
  }
  if (endpoint.sse) curlLines.push('  -N')
  const curl = curlLines.join(' \\\n')

  const jsHeaders = [
    ...(isApiKey ? ['    Authorization: `Bearer ${DYPER_API_KEY}`,'] : []),
    ...(needsAppKey ? ["    'X-App-Key': APP_KEY,"] : []),
    ...(hasBody && !isMultipart ? ["    'Content-Type': 'application/json',"] : []),
  ].join('\n')
  const jsBody = isMultipart
    ? `  body: formData, // FormData avec file/text/lang\n`
    : hasBody
      ? `  body: JSON.stringify(${JSON.stringify(bodyObject)}),\n`
      : ''
  const js = `const res = await fetch('${url}', {
  method: '${endpoint.method}',
${usesCookie ? "  credentials: 'include',\n" : ''}  headers: {
${jsHeaders}
  },
${jsBody}})
${endpoint.sse ? 'const reader = res.body.getReader() // flux SSE' : 'const data = await res.json()'}`

  const pyHeaders = isApiKey
    ? "{'Authorization': f'Bearer {DYPER_API_KEY}'}"
    : needsAppKey
      ? "{'X-App-Key': APP_KEY}"
      : '{}'
  const pyCookies = usesCookie ? '\n    cookies=cookies,' : ''
  const pyCall = isMultipart
    ? `requests.${endpoint.method.toLowerCase()}(\n    '${url}',\n    headers=${pyHeaders},${pyCookies}\n    files={'file': open('photo.jpg', 'rb')},\n    data={'text': 'Que vois-tu ?'},\n)`
    : hasBody
      ? `requests.${endpoint.method.toLowerCase()}(\n    '${url}',\n    headers=${pyHeaders},${pyCookies}\n    json=${JSON.stringify(bodyObject)},\n${endpoint.sse ? '    stream=True,\n' : ''})`
      : `requests.${endpoint.method.toLowerCase()}('${url}', headers=${pyHeaders}${usesCookie ? ', cookies=cookies' : ''})`
  const python = `import requests

res = ${pyCall}
${endpoint.sse ? 'for line in res.iter_lines():\n    print(line)  # frames SSE' : 'print(res.json())'}`

  return { curl, js, python }
}
