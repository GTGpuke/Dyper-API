// Référence statique de l'API Dyper : structure typée pilotant la page /api-docs.
// Les descriptions sont des clés i18n ; les exemples de code sont générés par buildSamples()
// afin que curl / JavaScript / Python ne divergent jamais.

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
export type AuthKind = 'appKey' | 'appKey+session' | 'session' | 'none'
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
        path: '/api/auth/register',
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
        path: '/api/auth/login',
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
        path: '/api/auth/logout',
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
        path: '/api/analyze',
        descKey: 'docs.ep.analyzeFile.desc',
        auth: 'appKey+session',
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
            lang: 'fr',
          },
        }),
      },
      {
        id: 'analyzeUrl',
        method: 'POST',
        path: '/api/analyze/url',
        descKey: 'docs.ep.analyzeUrl.desc',
        auth: 'appKey+session',
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
        path: '/api/analyze/prompt',
        descKey: 'docs.ep.analyzePrompt.desc',
        auth: 'appKey+session',
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
        path: '/api/conversations',
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
        path: '/api/conversations',
        descKey: 'docs.ep.createConversation.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [{ name: 'title', type: 'string (≤ 120)', required: false, descKey: 'docs.p.title' }],
        responseExample: json({ success: true, conversation: { id: 'uuid', title: 'Nouvelle conversation' } }),
      },
      {
        id: 'getConversation',
        method: 'GET',
        path: '/api/conversations/:id',
        descKey: 'docs.ep.getConversation.desc',
        auth: 'appKey+session',
        responseExample: json({
          success: true,
          conversation: { id: 'uuid', title: '…' },
          messages: [
            { id: 'uuid', role: 'user', kind: 'text', content: 'Que vois-tu ?', seq: 1 },
            {
              id: 'uuid',
              role: 'assistant',
              kind: 'analysis',
              seq: 2,
              analysis: { requestId: 'uuid', description: '…', thumbnailUrl: '/api/media/uuid' },
            },
          ],
        }),
      },
      {
        id: 'renameConversation',
        method: 'PATCH',
        path: '/api/conversations/:id',
        descKey: 'docs.ep.renameConversation.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [{ name: 'title', type: 'string (1–120)', required: true, descKey: 'docs.p.title' }],
        responseExample: json({ success: true, conversation: { id: 'uuid', title: 'Nouveau titre' } }),
      },
      {
        id: 'deleteConversation',
        method: 'DELETE',
        path: '/api/conversations/:id',
        descKey: 'docs.ep.deleteConversation.desc',
        auth: 'appKey+session',
        responseExample: json({ success: true }),
      },
      {
        id: 'postMessage',
        method: 'POST',
        path: '/api/conversations/:id/messages',
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
          messages: ['message utilisateur', 'message assistant (carte ou texte)'],
        }),
      },
      {
        id: 'streamMessage',
        method: 'POST',
        path: '/api/conversations/:id/messages/stream',
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
        path: '/api/analyses',
        descKey: 'docs.ep.listAnalyses.desc',
        auth: 'appKey+session',
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
        path: '/api/analyses/:id',
        descKey: 'docs.ep.getAnalysis.desc',
        auth: 'appKey+session',
        responseExample: json({ data: { id: 'uuid', description: '…', timeline: '…' } }),
      },
      {
        id: 'getChatHistory',
        method: 'GET',
        path: '/api/analyses/:requestId/chat',
        descKey: 'docs.ep.getChatHistory.desc',
        auth: 'appKey+session',
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
        path: '/api/media/:requestId',
        descKey: 'docs.ep.getMedia.desc',
        auth: 'session',
        responseExample: 'image/jpeg (binaire)',
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
        path: '/api/me',
        descKey: 'docs.ep.getMe.desc',
        auth: 'appKey+session',
        responseExample: json({
          success: true,
          user: { id: 'uuid', email: 'vous@exemple.fr' },
          settings: { appearance: { theme: 'system' }, analysis: { defaultLang: 'fr' } },
        }),
      },
      {
        id: 'updateSettings',
        method: 'PUT',
        path: '/api/me/settings',
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
        path: '/api/me/export',
        descKey: 'docs.ep.exportData.desc',
        auth: 'appKey+session',
        responseExample: json({ user: '…', analyses: ['…'], conversations: ['…'] }),
      },
      {
        id: 'purgeHistory',
        method: 'DELETE',
        path: '/api/me/history',
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
        path: '/api/me/account',
        descKey: 'docs.ep.deleteAccount.desc',
        auth: 'appKey+session',
        paramsKind: 'body',
        params: [{ name: 'password', type: 'string', required: true, descKey: 'docs.p.password' }],
        responseExample: json({ success: true }),
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
  const needsAppKey = endpoint.auth === 'appKey' || endpoint.auth === 'appKey+session'
  const bodyParams = endpoint.paramsKind === 'body' ? (endpoint.params ?? []) : []
  const bodyObject = Object.fromEntries(bodyParams.map((p) => [p.name, `<${p.name}>`]))
  const hasBody = bodyParams.length > 0
  const isMultipart = endpoint.paramsKind === 'multipart'

  const curlLines = [`curl -X ${endpoint.method} "${url}"`]
  if (needsAppKey) curlLines.push('  -H "X-App-Key: $APP_KEY"')
  curlLines.push('  -b cookies.txt')
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
  credentials: 'include',
  headers: {
${jsHeaders}
  },
${jsBody}})
${endpoint.sse ? 'const reader = res.body.getReader() // flux SSE' : 'const data = await res.json()'}`

  const pyHeaders = needsAppKey ? "{'X-App-Key': APP_KEY}" : '{}'
  const pyCall = isMultipart
    ? `requests.${endpoint.method.toLowerCase()}(\n    '${url}',\n    headers=${pyHeaders},\n    cookies=cookies,\n    files={'file': open('photo.jpg', 'rb')},\n    data={'text': 'Que vois-tu ?'},\n)`
    : hasBody
      ? `requests.${endpoint.method.toLowerCase()}(\n    '${url}',\n    headers=${pyHeaders},\n    cookies=cookies,\n    json=${JSON.stringify(bodyObject)},\n${endpoint.sse ? '    stream=True,\n' : ''})`
      : `requests.${endpoint.method.toLowerCase()}('${url}', headers=${pyHeaders}, cookies=cookies)`
  const python = `import requests

res = ${pyCall}
${endpoint.sse ? 'for line in res.iter_lines():\n    print(line)  # frames SSE' : 'print(res.json())'}`

  return { curl, js, python }
}
