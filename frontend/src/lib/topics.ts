// Display names for topic IDs (same list as backend/app/agent/topics.py).
export const TOPIC_LABELS: Record<string, string> = {
  python: 'Python',
  sql_basics: 'SQL joins & aggregation',
  sql_advanced: 'SQL window functions & CTEs',
  pandas: 'pandas & data wrangling',
  statistics: 'Statistics & probability',
  ml_fundamentals: 'ML fundamentals',
  supervised_learning: 'Supervised learning',
  unsupervised_learning: 'Unsupervised learning',
  model_evaluation: 'Model evaluation',
  feature_engineering: 'Feature engineering',
  deep_learning: 'Deep learning',
  nlp_llms: 'NLP & LLMs',
  computer_vision: 'Computer vision',
  mlops: 'MLOps & deployment',
  data_visualization: 'Data visualisation',
  project_deep_dive: 'Project deep-dive',
  behavioural: 'Behavioural',
}

export const topicLabel = (id: string) => TOPIC_LABELS[id] ?? id
