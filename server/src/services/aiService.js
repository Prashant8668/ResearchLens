/**
 * Phase 7 — AI-Powered Structured Summarization Service
 * Supports official Google Gemini SDK (@google/genai) and OpenAI GPT-4o.
 * Produces validated, grounded academic research summaries adhering strictly to schema.
 */

const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

class AIConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AIConfigurationError';
    this.status = 503;
    this.isOperational = true;
  }
}

class AIValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AIValidationError';
    this.status = 400;
    this.isOperational = true;
  }
}

class AISchemaValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AISchemaValidationError';
    this.status = 502;
    this.isOperational = true;
  }
}

class AIServiceError extends Error {
  constructor(message, statusCode = 502, isTransient = false) {
    super(message);
    this.name = 'AIServiceError';
    this.status = statusCode;
    this.isTransient = isTransient;
    this.isOperational = true;
  }
}

const DEFAULT_CONFIG = {
  groqModel: 'openai/gpt-oss-120b',
  groqApiUrl: 'https://api.groq.com/openai/v1/chat/completions',
  openaiModel: 'gpt-4o',
  geminiModel: 'gemini-2.5-flash',
  openaiApiUrl: 'https://api.openai.com/v1/chat/completions',
  timeoutMs: 60000,
  maxRetries: 2,
  initialBackoffMs: 1000,
  maxChunkChars: 16000,
  chunkOverlapChars: 1000,
};

const SYSTEM_PROMPT = `You are an expert academic research assistant producing rigorous, faithful structured summaries of academic research papers.

You must return a valid JSON object with EXACTLY the following structure:
{
  "researchProblem": "The specific research problem, challenge, or knowledge gap addressed by the paper.",
  "objective": "The primary goal, hypothesis, or research objective of the study.",
  "methodology": "The technical approach, datasets, experimental setup, tools, or theoretical frameworks used.",
  "keyFindings": [
    "Key finding or empirical result 1 directly reported by the authors",
    "Key finding or empirical result 2 directly reported by the authors"
  ],
  "limitations": [
    "Limitation, constraint, or threat to validity 1",
    "Limitation, constraint, or threat to validity 2"
  ]
}

STRICT GUIDELINES:
1. Grounding: Rely ONLY on facts directly stated in the provided text. Never assume, extrapolate, or fabricate information.
2. Missing Information: If the paper does not provide enough information for a field, explicitly state: "The provided document does not contain sufficient information to determine the [field name]."
3. Limitations: Do not treat the absence of an explicit limitations section as proof that the research has no limitations. If limitations are not stated, state: "The authors do not explicitly report limitations in the provided document."
4. Findings: List only empirical results, metrics, or concrete conclusions explicitly claimed by the authors. Distinguish reported findings from interpretations.
5. Format: Return ONLY raw JSON matching the schema. No markdown backticks, no conversational commentary.`;

/**
 * Split long document text into overlapping chunks along paragraph boundaries.
 */
function chunkText(text, maxChars = DEFAULT_CONFIG.maxChunkChars, overlapChars = DEFAULT_CONFIG.chunkOverlapChars) {
  if (!text || text.length <= maxChars) {
    return [text];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + maxChars;

    if (endIndex < text.length) {
      // Look for a paragraph break near the end of the chunk
      const paragraphBreak = text.lastIndexOf('\n\n', endIndex);
      if (paragraphBreak > startIndex + maxChars * 0.6) {
        endIndex = paragraphBreak + 2;
      } else {
        // Look for a sentence break
        const sentenceBreak = text.lastIndexOf('. ', endIndex);
        if (sentenceBreak > startIndex + maxChars * 0.6) {
          endIndex = sentenceBreak + 2;
        }
      }
    } else {
      endIndex = text.length;
    }

    const chunk = text.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (endIndex >= text.length) break;

    // Advance with overlap
    startIndex = Math.max(startIndex + 1, endIndex - overlapChars);
  }

  return chunks;
}

/**
 * Validates and normalizes structured summary output against required schema.
 */
function validateStructuredSummary(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new AISchemaValidationError('AI output is not a valid JSON object');
  }

  const cleanString = (val, fieldName) => {
    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
    if (Array.isArray(val) && val.length > 0) return val.map(v => String(v)).join(' ').trim();
    return `The provided document does not contain sufficient information to determine the ${fieldName}.`;
  };

  const cleanArray = (val, fieldName) => {
    if (Array.isArray(val) && val.length > 0) {
      const items = val.map(item => String(item).trim()).filter(Boolean);
      if (items.length > 0) return items;
    }
    if (typeof val === 'string' && val.trim().length > 0) {
      const splitItems = val.split(/\n+|•|- /).map(s => s.trim()).filter(Boolean);
      if (splitItems.length > 0) return splitItems;
    }
    return [`The provided document does not contain sufficient information to determine ${fieldName}.`];
  };

  return {
    researchProblem: cleanString(data.researchProblem, 'research problem'),
    objective: cleanString(data.objective, 'objective'),
    methodology: cleanString(data.methodology, 'methodology'),
    keyFindings: cleanArray(data.keyFindings, 'key findings'),
    limitations: cleanArray(data.limitations, 'limitations'),
  };
}

/**
 * Execute content generation call to Google Gemini using official @google/genai SDK.
 */
async function callGemini(contents, systemInstruction, options = {}) {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey === 'your_new_gemini_api_key' || apiKey === 'your-gemini-api-key') {
    throw new AIConfigurationError('Gemini API key is not configured on the server. Please set GEMINI_API_KEY in server/.env or server environment.');
  }

  const model = options.model || (process.env.GEMINI_MODEL && process.env.GEMINI_MODEL.trim() && process.env.GEMINI_MODEL !== 'your_gemini_model_id' ? process.env.GEMINI_MODEL.trim() : DEFAULT_CONFIG.geminiModel);

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemInstruction || SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const content = response.text;
    if (!content || !content.trim()) {
      throw new AISchemaValidationError('Gemini returned an empty completion content');
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      throw new AISchemaValidationError(`Failed to parse Gemini response as JSON: ${parseErr.message}`);
    }

    return {
      parsed,
      rawContent: content,
      model,
      usage: response.usageMetadata || null,
      provider: 'gemini',
    };
  } catch (err) {
    if (err instanceof AISchemaValidationError || err instanceof AIConfigurationError) {
      throw err;
    }

    const errMsg = err.message || '';
    const errStatus = err.status || err.statusCode;

    // Authentication failure
    if (errStatus === 401 || errStatus === 403 || errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid')) {
      throw new AIServiceError('Authentication failed with Gemini. Please verify your GEMINI_API_KEY.', 401, false);
    }

    // Model unavailable
    if (errStatus === 404 || (errMsg.includes('models/') && errMsg.includes('not found'))) {
      throw new AIServiceError(`Gemini model '${model}' is unavailable or not found.`, 404, false);
    }

    // Quota / rate limit exceeded
    if (errStatus === 429 || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('rate limit')) {
      throw new AIServiceError(`Gemini quota or rate limit exceeded: ${errMsg}`, 429, true);
    }

    throw new AIServiceError(`Gemini service error: ${errMsg}`, errStatus || 502, false);
  }
}

/**
 * Execute chat completion call to Groq with transient retry and backoff.
 * OpenAI-compatible REST API. Never logs or prints credentials.
 */
async function callGroq(messages, options = {}) {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey === 'your_new_groq_api_key' || apiKey === 'your-groq-api-key') {
    throw new AIConfigurationError('Groq API key is not configured on the server. Please set GROQ_API_KEY in server/.env or server environment.');
  }

  let model = options.model || (process.env.GROQ_MODEL && process.env.GROQ_MODEL.trim() && process.env.GROQ_MODEL !== 'your_supported_groq_model_id' ? process.env.GROQ_MODEL.trim() : DEFAULT_CONFIG.groqModel);
  const apiUrl = options.apiUrl || process.env.GROQ_API_URL || DEFAULT_CONFIG.groqApiUrl;
  const timeout = options.timeoutMs || Number(process.env.GROQ_TIMEOUT_MS) || DEFAULT_CONFIG.timeoutMs;
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 1;
  const initialBackoffMs = options.initialBackoffMs || 500;

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const response = await axios.post(
        apiUrl,
        {
          model,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.1,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          timeout,
        }
      );

      const content = response?.data?.choices?.[0]?.message?.content;
      if (!content || !content.trim()) {
        throw new AISchemaValidationError('Groq returned empty completion content');
      }

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseErr) {
        throw new AISchemaValidationError(`Failed to parse Groq response as JSON: ${parseErr.message}`);
      }

      return {
        parsed,
        rawContent: content,
        model: response.data?.model || model,
        usage: response.data?.usage || null,
        provider: 'groq',
      };
    } catch (err) {
      attempt++;

      if (err instanceof AISchemaValidationError || err instanceof AIConfigurationError) {
        throw err;
      }

      const status = err.response?.status;
      const errorObj = err.response?.data?.error;
      const errorCode = errorObj?.code;
      const errorType = errorObj?.type;
      const errorMessage = typeof errorObj?.message === 'string' ? errorObj.message : null;

      // 401/403 Authentication failure (Non-retryable)
      if (status === 401 || status === 403) {
        throw new AIServiceError('Authentication failed with Groq. Please verify your GROQ_API_KEY.', 401, false);
      }

      // 400 Bad Request (Non-retryable)
      if (status === 400) {
        const detail = errorMessage || 'Invalid request payload sent to Groq.';
        throw new AIServiceError(`Groq rejected request: ${detail}`, 400, false);
      }

      // 404 Model Not Found (Non-retryable)
      if (status === 404) {
        throw new AIServiceError(`Groq model '${model}' is unavailable or not found.`, 404, false);
      }

      // 429 Rate Limit (Retryable/Eligible for fallback)
      const isRateLimit = status === 429 ||
        errorCode === 'rate_limit_exceeded' ||
        errorType === 'rate_limit_exceeded' ||
        (errorMessage && (errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('tpm') || errorMessage.toLowerCase().includes('rpm')));

      // Temporary server outage 500-504 (Retryable/Eligible for fallback)
      const isServerOutage = (status >= 500 && status <= 504);

      // Network timeout / connection drops (Retryable/Eligible for fallback)
      const isNetworkTimeout = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.message?.includes('timeout');
      const isConnectionError = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET';

      const isTransient = isRateLimit || isServerOutage || isNetworkTimeout || isConnectionError;

      if (isTransient && attempt <= maxRetries) {
        const delay = initialBackoffMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (isRateLimit) {
        const rateLimitMsg = errorMessage || 'Groq rate limit exceeded. Please try again shortly.';
        throw new AIServiceError(`Groq rate limit exceeded: ${rateLimitMsg}`, 429, true);
      }
      if (isNetworkTimeout) {
        throw new AIServiceError('Groq request timed out.', 408, true);
      }
      if (isConnectionError) {
        throw new AIServiceError('Groq service is unreachable. Please check network connectivity.', 503, true);
      }
      if (isServerOutage) {
        const outageMsg = errorMessage || 'Groq service is temporarily unavailable.';
        throw new AIServiceError(`Groq temporary outage (${status}): ${outageMsg}`, status || 502, true);
      }

      const safeMessage = errorMessage || err.message || 'Groq encountered an unexpected error.';
      throw new AIServiceError(`Groq service error: ${safeMessage}`, status || 502, isTransient);
    }
  }
}

/**
 * Execute chat completion call to OpenAI with transient retry and backoff.
 */
async function callOpenAI(messages, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new AIConfigurationError('OpenAI API key is not configured on the server. Please set OPENAI_API_KEY in server/.env or server environment.');
  }

  const model = options.model || process.env.OPENAI_MODEL || DEFAULT_CONFIG.openaiModel;
  const apiUrl = options.apiUrl || process.env.OPENAI_API_URL || DEFAULT_CONFIG.openaiApiUrl;
  const timeout = options.timeoutMs || Number(process.env.OPENAI_TIMEOUT_MS) || DEFAULT_CONFIG.timeoutMs;
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : DEFAULT_CONFIG.maxRetries;
  const initialBackoffMs = options.initialBackoffMs || DEFAULT_CONFIG.initialBackoffMs;

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const response = await axios.post(
        apiUrl,
        {
          model,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.1,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          timeout,
        }
      );

      const content = response?.data?.choices?.[0]?.message?.content;
      if (!content || !content.trim()) {
        throw new AISchemaValidationError('OpenAI returned an empty completion content');
      }

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseErr) {
        throw new AISchemaValidationError(`Failed to parse response as JSON: ${parseErr.message}`);
      }

      return {
        parsed,
        rawContent: content,
        model: response.data?.model || model,
        usage: response.data?.usage || null,
        provider: 'openai',
      };
    } catch (err) {
      attempt++;

      if (err instanceof AISchemaValidationError || err instanceof AIConfigurationError) {
        throw err;
      }

      const status = err.response?.status;
      const errorObj = err.response?.data?.error;
      const errorCode = errorObj?.code;
      const errorType = errorObj?.type;
      const errorMessage = typeof errorObj?.message === 'string' ? errorObj.message : null;

      if (status === 401 || status === 403) {
        throw new AIServiceError('Authentication failed with the AI service. Please verify your API key.', 401, false);
      }

      const isQuotaExhausted =
        errorCode === 'insufficient_quota' ||
        errorCode === 'credit_balance_exhausted' ||
        errorType === 'insufficient_quota' ||
        (errorMessage && (errorMessage.includes('credits remaining') || errorMessage.includes('billing')));

      if (isQuotaExhausted) {
        const quotaMsg = errorMessage || 'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.';
        throw new AIServiceError(`OpenAI quota exceeded: ${quotaMsg}`, 429, false);
      }

      if (status === 400) {
        const detail = errorMessage || 'Invalid request payload sent to AI service.';
        throw new AIServiceError(`AI service rejected request: ${detail}`, 400, false);
      }

      const isTransient = status === 429 || (status >= 500 && status <= 504) || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.message?.includes('timeout');

      if (isTransient && attempt <= maxRetries) {
        const delay = initialBackoffMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (status === 429) {
        const rateLimitMsg = errorMessage || 'AI service rate limit exceeded. Please try again shortly.';
        throw new AIServiceError(`AI service rate limit exceeded: ${rateLimitMsg}`, 429, true);
      }
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        throw new AIServiceError('AI service request timed out.', 408, true);
      }
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        throw new AIServiceError('AI service is unreachable. Please check network connectivity.', 503, true);
      }

      const safeMessage = errorMessage || err.message || 'AI service encountered an unexpected error.';
      throw new AIServiceError(`AI service error: ${safeMessage}`, status || 502, isTransient);
    }
  }
}

/**
 * Helper to determine active AI provider ('groq', 'gemini', or 'openai')
 */
function getActiveProvider() {
  return (process.env.AI_PROVIDER || 'groq').toLowerCase().trim();
}

/**
 * Helper to determine active AI model name
 */
function getActiveModel() {
  const provider = getActiveProvider();
  if (provider === 'groq') {
    const m = process.env.GROQ_MODEL;
    if (m && m.trim() && m !== 'your_supported_groq_model_id') {
      return m.trim();
    }
    return DEFAULT_CONFIG.groqModel;
  }
  if (provider === 'gemini') {
    return process.env.GEMINI_MODEL || DEFAULT_CONFIG.geminiModel;
  }
  return process.env.OPENAI_MODEL || DEFAULT_CONFIG.openaiModel;
}

/**
 * Helper to check if credentials for active provider are present
 */
function isConfigured() {
  const provider = getActiveProvider();
  if (provider === 'groq') {
    const groqKey = process.env.GROQ_API_KEY;
    const hasGroq = !!(groqKey && groqKey.trim() && groqKey !== 'your_new_groq_api_key' && groqKey !== 'your-groq-api-key');
    const geminiKey = process.env.GEMINI_API_KEY;
    const hasGemini = !!(geminiKey && geminiKey.trim() && geminiKey !== 'your_new_gemini_api_key' && geminiKey !== 'your-gemini-api-key');
    return hasGroq || hasGemini;
  }
  if (provider === 'gemini') {
    const key = process.env.GEMINI_API_KEY;
    return !!(key && key.trim() && key !== 'your_new_gemini_api_key' && key !== 'your-gemini-api-key');
  }
  const key = process.env.OPENAI_API_KEY;
  return !!(key && key.trim() && key !== 'your_new_openai_api_key' && key !== 'your-openai-api-key');
}

/**
 * Executes a single-pass or multi-pass summary using the specified provider.
 */
async function executeSingleProviderSummary(targetProvider, cleanText, chunks, isShortText, options = {}) {
  const runPass = async (prompt, sysInstruction) => {
    if (targetProvider === 'gemini') {
      return await callGemini(prompt, sysInstruction, options);
    }
    const messages = [
      { role: 'system', content: sysInstruction },
      { role: 'user', content: prompt },
    ];
    if (targetProvider === 'groq') {
      return await callGroq(messages, options);
    }
    return await callOpenAI(messages, options);
  };

  if (chunks.length === 1) {
    const userPrompt = isShortText
      ? `The following text is brief or an excerpt from a research paper. Summarize ONLY what is explicitly supported by the text below. For fields without sufficient evidence, state: "The provided document does not contain sufficient information to determine the [field name]."\n\nDOCUMENT TEXT:\n"""\n${cleanText}\n"""`
      : `Analyze the following academic research paper text and extract the required structured summary:\n\nDOCUMENT TEXT:\n"""\n${cleanText}\n"""`;

    const result = await runPass(userPrompt, SYSTEM_PROMPT);
    const validated = validateStructuredSummary(result.parsed);

    return {
      structuredSummary: {
        ...validated,
        model: result.model,
        generatedAt: new Date(),
      },
      usage: result.usage,
      chunksProcessed: 1,
      provider: targetProvider,
    };
  }

  // Multi-pass chunking and consolidation for long documents
  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkPrompt = `Extract findings, problems, methodology, and limitations from this chunk:\n\n"""\n${chunks[i]}\n"""`;
    const chunkSys = `You are extracting partial structured research observations from Chunk ${i + 1} of ${chunks.length} of a long academic paper. Output raw JSON matching the required schema with facts from this chunk only.`;

    const chunkResult = await runPass(chunkPrompt, chunkSys);
    chunkSummaries.push(chunkResult.parsed);
  }

  const consolidationPrompt = `Below are structured observations extracted from across all ${chunks.length} chunks of a long research paper:

${JSON.stringify(chunkSummaries, null, 2)}

Synthesize these observations into a single, cohesive, non-redundant structured summary according to the required schema. Ensure all key empirical findings, methodology details, and limitations discovered across all chunks are preserved in the final JSON.`;

  const finalResult = await runPass(consolidationPrompt, SYSTEM_PROMPT);
  const validated = validateStructuredSummary(finalResult.parsed);

  return {
    structuredSummary: {
      ...validated,
      model: finalResult.model,
      generatedAt: new Date(),
    },
    usage: finalResult.usage,
    chunksProcessed: chunks.length,
    provider: targetProvider,
  };
}

/**
 * Generate a validated structured summary from paper text.
 * Primary provider: Groq (default when AI_PROVIDER=groq).
 * Fallback provider: Google Gemini (for retryable rate limits / temporary outages).
 * Also supports direct 'gemini' and 'openai' configurations.
 */
async function generateStructuredSummary(text, options = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AIValidationError('The paper does not contain any extractable text to summarize.');
  }

  const cleanText = text.trim();
  const provider = (options.provider || getActiveProvider()).toLowerCase().trim();
  const maxChunkChars = options.maxChunkChars || DEFAULT_CONFIG.maxChunkChars;
  const isShortText = cleanText.length < 500;
  const chunks = chunkText(cleanText, maxChunkChars, options.chunkOverlapChars);

  if (provider !== 'groq' && provider !== 'gemini' && provider !== 'openai') {
    throw new AIConfigurationError(`Unsupported AI provider: '${provider}'. Supported providers are 'groq', 'gemini', and 'openai'.`);
  }

  // When provider is Groq: route to Groq as primary, fallback to Gemini only on retryable failures
  if (provider === 'groq') {
    try {
      return await executeSingleProviderSummary('groq', cleanText, chunks, isShortText, options);
    } catch (primaryErr) {
      if (primaryErr instanceof AIConfigurationError || primaryErr instanceof AIValidationError) {
        throw primaryErr;
      }

      // Check if error is an appropriate retryable provider failure (rate limit, temporary outage, timeout)
      const isRetryable = primaryErr.isTransient === true ||
        primaryErr.status === 429 ||
        (primaryErr.status >= 500 && primaryErr.status <= 504) ||
        primaryErr.status === 408 ||
        primaryErr.code === 'ECONNABORTED' ||
        primaryErr.code === 'ETIMEDOUT' ||
        primaryErr.code === 'ECONNRESET' ||
        primaryErr.code === 'ECONNREFUSED' ||
        primaryErr.message?.toLowerCase().includes('rate limit') ||
        primaryErr.message?.toLowerCase().includes('quota') ||
        primaryErr.message?.toLowerCase().includes('timeout') ||
        primaryErr.message?.toLowerCase().includes('outage');

      const geminiKey = options.fallbackApiKey || process.env.GEMINI_API_KEY;
      const canFallbackToGemini = !options.noFallback &&
        isRetryable &&
        geminiKey &&
        geminiKey.trim() &&
        geminiKey !== 'your_new_gemini_api_key' &&
        geminiKey !== 'your-gemini-api-key';

      if (!canFallbackToGemini) {
        throw primaryErr;
      }

      console.warn(`[AI Service] Groq primary provider encountered retryable failure (${primaryErr.status || primaryErr.name}: ${primaryErr.message}). Routing fallback to Gemini.`);

      try {
        const fallbackModel = options.fallbackModel || (process.env.GEMINI_MODEL && process.env.GEMINI_MODEL.trim() && process.env.GEMINI_MODEL !== 'your_gemini_model_id' ? process.env.GEMINI_MODEL.trim() : DEFAULT_CONFIG.geminiModel);
        const fallbackOptions = {
          ...options,
          model: fallbackModel,
          apiKey: geminiKey,
        };
        const fallbackResult = await executeSingleProviderSummary('gemini', cleanText, chunks, isShortText, fallbackOptions);

        return {
          ...fallbackResult,
          fallbackUsed: true,
          primaryProvider: 'groq',
          fallbackReason: primaryErr.message,
        };
      } catch (fallbackErr) {
        throw new AIServiceError(
          `Primary provider (Groq) failed with: ${primaryErr.message}. Fallback provider (Gemini) also failed: ${fallbackErr.message}`,
          fallbackErr.status || primaryErr.status || 502,
          false
        );
      }
    }
  }

  // Direct execution for gemini or openai
  return await executeSingleProviderSummary(provider, cleanText, chunks, isShortText, options);
}

module.exports = {
  generateStructuredSummary,
  validateStructuredSummary,
  chunkText,
  callGroq,
  callGemini,
  callOpenAI,
  getActiveProvider,
  getActiveModel,
  isConfigured,
  AIConfigurationError,
  AIValidationError,
  AISchemaValidationError,
  AIServiceError,
  DEFAULT_CONFIG,
};
