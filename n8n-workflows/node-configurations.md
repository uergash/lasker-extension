# n8n Node Configurations - Step by Step

This document provides detailed configuration for each node in the email processing workflows.

---

## 🔷 Main Workflow: "Email Flow - Submission Processor"

### Node 1: Webhook

**Type:** `Webhook`  
**Method:** `POST`  
**Path:** `/webhook/email-submission`  
**Authentication:** None (or add API key if desired)

**Response:**
- Mode: `Respond to Webhook`
- Response Code: `200`
- Response Body: Will be set by later node

---

### Node 2: Set Variables

**Type:** `Set`  
**Purpose:** Extract and format incoming data

**Values to Set:**
```javascript
// Email data
{{ $json.email.from.email }}       → email_from
{{ $json.email.from.name }}        → email_name
{{ $json.email.subject }}          → email_subject
{{ $json.email.body }}             → email_body
{{ $json.email.date }}             → email_date
{{ $json.email.threadId }}         → thread_id
{{ $json.email.sourceUrl }}        → source_url
{{ $json.email.labels }}           → labels

// Metadata
{{ $json.metadata.userId }}        → user_email
{{ $json.metadata.source }}        → source
{{ $json.metadata.timestamp }}     → submission_timestamp
```

---

### Node 3: Function - Validate Input

**Type:** `Function`  
**Purpose:** Validate required fields exist

```javascript
// Validate required fields
const requiredFields = [
  'email_from',
  'email_body',
  'user_email'
];

const item = items[0].json;

for (const field of requiredFields) {
  if (!item[field] || item[field].trim() === '') {
    throw new Error(`Missing required field: ${field}`);
  }
}

// Check email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(item.email_from)) {
  throw new Error('Invalid from_email format');
}

if (!emailRegex.test(item.user_email)) {
  throw new Error('Invalid user_email format');
}

// Return validated data
return items;
```

---

### Node 4: Function - Check for Duplicate Thread

**Type:** `Function`  
**Purpose:** Check if thread was already processed

```javascript
// If no thread_id, allow processing
const threadId = items[0].json.thread_id;
if (!threadId) {
  return items;
}

// Mark that we need to check duplicates
items[0].json.check_duplicate = true;
items[0].json.thread_id_to_check = threadId;

return items;
```

---

### Node 5: Supabase - Check Duplicate (Conditional)

**Type:** `Postgres`  
**Operation:** `Execute Query`  
**Connection:** Your Supabase credentials

**Execute Only If:** `{{ $json.check_duplicate === true }}`

**Query:**
```sql
SELECT COUNT(*) as count 
FROM email_submissions 
WHERE thread_id = '{{ $json.thread_id_to_check }}'
AND processing_status IN ('completed', 'processing');
```

---

### Node 6: IF - Skip if Duplicate

**Type:** `IF`  
**Condition:**

```
Value 1: {{ $json.count }}
Operation: Smaller or Equal
Value 2: 0
```

**True branch:** Continue to insert  
**False branch:** Return "already processed" response

---

### Node 7: Supabase - Insert Email Submission

**Type:** `Postgres`  
**Operation:** `Insert`  
**Table:** `email_submissions`

**Columns:**
```javascript
from_email:        {{ $json.email_from }}
from_name:         {{ $json.email_name }}
subject:           {{ $json.email_subject }}
body:              {{ $json.email_body }}
email_date:        {{ $json.email_date }}
thread_id:         {{ $json.thread_id }}
source:            {{ $json.source || 'gmail' }}
source_url:        {{ $json.source_url }}
metadata:          {{ JSON.stringify({ labels: $json.labels }) }}
processing_status: 'pending'
user_id:           null  // Will be set via user lookup if needed
created_at:        NOW()
```

**Options:**
- Return Fields: `id, created_at`

---

### Node 8: Set - Store Submission ID

**Type:** `Set`

```javascript
{{ $json.id }} → submission_id
```

---

### Node 9: Execute Workflow - Process Insights

**Type:** `Execute Workflow`  
**Workflow:** `Email Flow - Process Insights`  
**Wait for Completion:** `true`

**Pass Data:**
```javascript
{
  submission_id: {{ $json.submission_id }},
  from_email: {{ $json.from_email }},
  from_name: {{ $json.from_name }},
  subject: {{ $json.subject }},
  body: {{ $json.body }},
  email_date: {{ $json.email_date }},
  source: {{ $json.source }}
}
```

---

### Node 10: Supabase - Update Status to Completed

**Type:** `Postgres`  
**Operation:** `Update`  
**Table:** `email_submissions`

**Where:** `id = {{ $json.submission_id }}`

**Update:**
```javascript
processing_status:   'completed'
insights_extracted:  {{ $json.insights_count }}
processed_at:        NOW()
updated_at:          NOW()
```

---

### Node 11: Respond to Webhook

**Type:** `Respond to Webhook`  
**Response Code:** `200`

**Response Body:**
```json
{
  "success": true,
  "submission_id": "{{ $json.submission_id }}",
  "insights_extracted": {{ $json.insights_count }},
  "message": "Email processed successfully"
}
```

---

### Node 12: Catch Error (Error Workflow)

**Type:** `Error Trigger`  
**Connected to:** All nodes

**Error Handler:**
```javascript
// Log error
console.error('Error processing email:', $json);

// Update submission status to failed
// (Add Supabase Update node here)

// Return error response
return {
  success: false,
  error: $json.error.message
};
```

---

## 🔶 Sub-workflow: "Email Flow - Process Insights"

### Node 1: Workflow Trigger

**Type:** `Workflow Trigger`  
**Receives:** Data from main workflow

---

### Node 2: Function - Build Context for OpenAI

**Type:** `Function`

```javascript
const item = items[0].json;

// Build email context
const emailContext = `
Email From: ${item.from_name} <${item.from_email}>
Subject: ${item.subject || '(No subject)'}
Date: ${item.email_date}

Email Content:
${item.body}
`.trim();

// Return with context
return [{
  json: {
    ...item,
    email_context: emailContext
  }
}];
```

---

### Node 3: OpenAI - Extract Insights

**Type:** `OpenAI`  
**Operation:** `Message a Model`  
**Model:** `gpt-4` or `gpt-3.5-turbo`

**System Message:**
```
You are an AI that extracts product insights from customer emails. 
Extract distinct, actionable insights about product features, bugs, or feedback.
Return insights as a JSON array.
```

**User Message:**
```
Extract insights from this customer email:

{{ $json.email_context }}

Return a JSON array of insights with this structure:
[
  {
    "insight": "Clear, specific description of the insight",
    "category": "feature_request|bug|feedback|question",
    "priority": "high|medium|low"
  }
]

Guidelines:
- Each insight should be atomic (one specific point)
- Be specific and actionable
- Don't include pleasantries or signatures
- Focus on product-related content
```

**Options:**
- Temperature: `0.3`
- Max Tokens: `500`
- Response Format: `json_object`

---

### Node 4: Function - Parse Insights

**Type:** `Function`

```javascript
const response = items[0].json.choices[0].message.content;
let insights;

try {
  insights = JSON.parse(response);
} catch (error) {
  console.error('Failed to parse OpenAI response:', response);
  throw new Error('Invalid JSON response from OpenAI');
}

// Validate insights array
if (!Array.isArray(insights) || insights.length === 0) {
  throw new Error('No insights extracted from email');
}

// Return insights with original data
return insights.map(insight => ({
  json: {
    ...items[0].json,
    insight_text: insight.insight,
    insight_category: insight.category,
    insight_priority: insight.priority
  }
}));
```

---

### Node 5: Stage 1 - Semantic Search for Features

**Type:** `HTTP Request` or `Supabase Vector Search` (if using embeddings)  
**Purpose:** Find top 5 matching features

**Simple Version (Keyword Match):**

**Type:** `Postgres`  
**Query:**
```sql
SELECT 
  id,
  name,
  description,
  similarity(name || ' ' || description, '{{ $json.insight_text }}') as score
FROM features
ORDER BY score DESC
LIMIT 5;
```

**Advanced Version (Vector Embeddings):**
1. Get embedding for insight
2. Query vector database
3. Return top 5 matches

---

### Node 6: Stage 2 - Feature Selection

**Type:** `OpenAI`  
**Model:** `gpt-4` or `gpt-3.5-turbo`

**System Message:**
```
You are an AI that matches insights to product features.
Given an insight and a list of potential features, select the best match or mark as "New Feature".
```

**User Message:**
```
Insight: {{ $json.insight_text }}

Potential Features:
{{ $json.features.map((f, i) => `${i+1}. ${f.name}: ${f.description}`).join('\n') }}

Select the best matching feature by number (1-5), or respond with "NEW" if this represents a new feature not in the list.
Also provide a confidence score (0-100).

Respond in JSON format:
{
  "match": "1-5 or NEW",
  "confidence": 85,
  "reasoning": "Brief explanation"
}
```

---

### Node 7: Stage 3 - Journey Stage Classification

**Type:** `OpenAI`  
**Model:** `gpt-3.5-turbo`

**System Message:**
```
You are an AI that classifies customer feedback into journey stages.
Stages: Awareness, Consideration, Purchase, Retention, Advocacy
```

**User Message:**
```
Classify this customer insight into a journey stage:

Insight: {{ $json.insight_text }}
Email Context: {{ $json.email_context }}

Respond in JSON format:
{
  "stage": "awareness|consideration|purchase|retention|advocacy",
  "confidence": 85,
  "reasoning": "Brief explanation"
}
```

---

### Node 8: Enrichment - Link to Customer

**Type:** `Postgres`  
**Purpose:** Find customer by email domain

**Query:**
```sql
SELECT id, name 
FROM customers 
WHERE domain = substring('{{ $json.from_email }}' from '@(.*)$')
LIMIT 1;
```

---

### Node 9: Supabase - Insert Insight

**Type:** `Postgres`  
**Operation:** `Insert`  
**Table:** `insights`

**Columns:**
```javascript
content:               {{ $json.insight_text }}
feature_id:            {{ $json.matched_feature_id || null }}
journey_stage:         {{ $json.journey_stage }}
source:                'email'
email_submission_id:   {{ $json.submission_id }}
customer_id:           {{ $json.customer_id || null }}
priority:              {{ $json.insight_priority }}
confidence_score:      {{ $json.confidence }}
metadata:              {{ JSON.stringify({
                            category: $json.insight_category,
                            from_email: $json.from_email,
                            subject: $json.subject
                          }) }}
created_at:            NOW()
```

---

### Node 10: Aggregate Results

**Type:** `Aggregate`  
**Aggregation:**

```javascript
{
  insights_count: items.length,
  submission_id: items[0].json.submission_id
}
```

---

### Node 11: Return to Workflow

**Type:** `Set`  
**Returns:** Count of insights to main workflow

---

## 🎨 Workflow Canvas Layout Tips

### Main Workflow Layout
```
[Webhook] → [Set] → [Validate] → [Check Dup] → [IF Duplicate?]
                                                    ↓ No
                                            [Insert Submission]
                                                    ↓
                                            [Execute Sub-workflow]
                                                    ↓
                                            [Update Status]
                                                    ↓
                                            [Respond Success]
```

### Sub-workflow Layout
```
[Trigger] → [Build Context] → [OpenAI Extract] → [Parse Insights]
                                                        ↓
                                                [Split Out Items]
                                                        ↓
                                  [Stage 1] → [Stage 2] → [Stage 3]
                                                        ↓
                                                [Enrichment]
                                                        ↓
                                                [Insert Insight]
                                                        ↓
                                                [Aggregate]
                                                        ↓
                                                [Return]
```

---

## 🔐 Credentials Setup

### Supabase (PostgreSQL)

1. Go to n8n **Credentials**
2. Add **Postgres**
3. Configure:
   - **Name:** `Supabase - Lasker`
   - **Host:** `db.[your-project-ref].supabase.co`
   - **Database:** `postgres`
   - **User:** `postgres`
   - **Password:** Your Supabase password
   - **Port:** `5432`
   - **SSL:** `require`

### OpenAI

1. Go to n8n **Credentials**
2. Add **OpenAI**
3. Configure:
   - **Name:** `OpenAI - Lasker`
   - **API Key:** Your OpenAI API key

---

## ✅ Testing Checklist

- [ ] Webhook URL is accessible
- [ ] Supabase connection works
- [ ] OpenAI API key is valid
- [ ] Test with sample email payload
- [ ] Verify insights inserted correctly
- [ ] Check error handling triggers
- [ ] Monitor execution logs
- [ ] Validate response format

---

**Ready to build?** Use these configurations to create your workflows node-by-node!

