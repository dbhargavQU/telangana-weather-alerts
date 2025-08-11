export const config = {
  openAiKey: process.env.OPENAI_API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/0',
  radarProvider: process.env.RADAR_PROVIDER || 'rainviewer',
  openMeteoBase: process.env.OPENMETEO_BASE || 'https://api.open-meteo.com/v1/forecast',
  tsdpsUrl: process.env.TSDPS_SOURCE_URL || '',
  imdNowcastUrl: process.env.IMD_NOWCAST_URL || '',
  devIngestToken: process.env.DEV_INGEST_TOKEN || '',
  useMock: process.env.USE_MOCK === 'true',
  relaxedRules: process.env.RELAXED_RULES === 'true',
  aiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  // Tweeting
  tweetEnable: process.env.TWEET_ENABLE === 'true',
  tweetMinGapMin: Number(process.env.TWEET_MIN_GAP_MIN || '60'),
  tweetDailyBudget: Number(process.env.TWEET_DAILY_BUDGET || '100'),
  tweetIncludeMedia: process.env.TWEET_INCLUDE_MEDIA === 'true',
  xApiKey: process.env.X_API_KEY || '',
  xApiSecret: process.env.X_API_SECRET || '',
  xAccessToken: process.env.X_ACCESS_TOKEN || '',
  xAccessSecret: process.env.X_ACCESS_SECRET || '',
  xAppBearer: process.env.X_APP_BEARER || '',
};


