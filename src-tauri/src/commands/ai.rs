use std::sync::LazyLock;
use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

static RE_EMAIL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").expect("valid email regex")
});

static RE_PHONE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}").expect("valid phone regex")
});

static RE_LINKEDIN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(https?://)?([a-z]{2,3}\.)?linkedin\.com/in/[a-zA-Z0-9-_%]+/?").expect("valid linkedin regex")
});

static RE_TITLE_PREFIX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)^(title|role|position|current position|current role|headline):\s*(.+)").expect("valid title prefix regex")
});

static RE_US_STATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b[A-Za-z\s.-]+,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|ON|BC|QC|AB)\b").expect("valid us state regex")
});

static RE_EXPLICIT_LOC: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b(location|address|based in|residing in|city):\s*([^\n\r,|]+(?:,\s*[^\n\r,|]+)?)").expect("valid explicit loc regex")
});

static RE_US_CITY_STATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b([A-Z][a-zA-Z\s.-]+),\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|ON|BC|QC|AB)\b(?:\s*\d{5})?").expect("valid us city state regex")
});

static RE_FULL_STATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b([A-Z][a-zA-Z\s.-]+),\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|United States|USA|Canada|UK|United Kingdom|India|Germany|Australia|France)\b").expect("valid full state regex")
});

static RE_EXPERIENCE_YEARS: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b(?:over\s+|more\s+than\s+|approx(?:\.|\s+)?|nearly\s+)?(\d{1,2})\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:professional|technical|industry|relevant|hands-on|work))?\s+experience\b").expect("valid exp regex")
});

static RE_EXP_COMPACT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b(\d{1,2})\+?\s*yrs?\s+(?:exp\b|experience\b)").expect("valid compact exp regex")
});

static RE_EXP_LEADING: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b(?:over\s+|more\s+than\s+|approx(?:\.|\s+)?|nearly\s+)?(\d{1,2})\+?\s*(?:years?|yrs?)\s+(?:leading|managing|building|working|architecting|developing|designing|consulting|in|as\s+a)\b").expect("valid leading exp regex")
});

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedCandidateProfile {
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub current_role: Option<String>,
    #[serde(default)]
    pub experience_years: Option<i64>,
    pub skills: Vec<String>,
    pub location: Option<String>,
    pub linkedin_url: Option<String>,
    pub notes_summary: Option<String>,
}

pub static CANONICAL_PRIMARY_SKILLS: &[&str] = &[
    // --- Languages ---
    "Python", "JavaScript", "TypeScript", "C++", "C#", "Rust", "Kotlin", "Scala", "PHP",
    "Ruby", "Solidity", "Elixir", "Haskell", "Clojure", "Perl", "Lua", "Groovy",
    "HTML5", "HTML", "CSS3", "CSS", "Bash", "PowerShell", "SQL", "PL/SQL", "T-SQL",
    "Java",

    // --- Frontend Frameworks & Libraries ---
    "React", "Next.js", "Vue", "Nuxt", "Angular", "Svelte", "Remix", "Gatsby", "Astro",
    "SolidJS", "Tailwind CSS", "Bootstrap", "Sass", "SCSS", "Redux", "Zustand", "MobX",
    "React Query", "Webpack", "Vite", "Rollup", "Babel", "Storybook", "Material UI",
    "Shadcn UI", "Chakra UI", "Ant Design", "Three.js", "WebGL", "WebAssembly",
    "Electron", "Tauri",

    // --- Backend Frameworks & Runtimes ---
    "Node.js", "Express", "NestJS", "FastAPI", "Django", "Fastify", "ASP.NET",
    "Laravel", "Symfony", "Quarkus", "Micronaut", "gRPC", "GraphQL", "WebSockets",
    "Microservices",

    // --- Databases & Storage ---
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "Elasticsearch", "OpenSearch",
    "DynamoDB", "Cassandra", "Oracle Database", "Microsoft SQL Server", "Firebase",
    "Supabase", "Snowflake", "BigQuery", "Redshift", "Databricks", "ClickHouse",
    "Neo4j", "Prisma", "TypeORM", "Drizzle ORM", "SQLAlchemy", "Hibernate",

    // --- Cloud & Infrastructure ---
    "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Terraform", "Ansible",
    "Helm", "CI/CD", "GitHub Actions", "Jenkins", "GitLab CI", "CircleCI", "ArgoCD",
    "Prometheus", "Grafana", "Datadog", "New Relic", "Splunk", "OpenTelemetry", "Sentry",
    "Linux", "Ubuntu", "Debian", "CentOS", "RHEL", "Nginx", "Apache Kafka", "RabbitMQ",

    // --- Data Engineering & AI/ML ---
    "Apache Flink", "Apache Airflow", "dbt", "PyTorch", "TensorFlow", "Keras",
    "Scikit-learn", "Pandas", "NumPy", "SciPy", "Hugging Face", "LangChain",
    "LlamaIndex", "OpenAI", "Computer Vision", "NLP", "MLflow", "Tableau", "Power BI",

    // --- Mobile & Testing ---
    "iOS", "Android", "React Native", "Flutter", "SwiftUI", "Jetpack Compose", "Xcode",
    "Jest", "Vitest", "Cypress", "Playwright", "Selenium", "PyTest", "JUnit", "Postman",

    // --- Tools, Design, Methodologies & Security ---
    "Git", "GitHub", "GitLab", "Figma", "Jira", "Confluence", "Agile", "Scrum",
    "OAuth", "OAuth 2.0", "JWT", "SAML", "Penetration Testing", "OWASP", "SOC 2", "ISO 27001",

    // --- Extended Languages ---
    "Dart", "Objective-C", "MATLAB", "Fortran", "VBA", "Julia", "F#", "OCaml",
    "Erlang", "Crystal", "Nim", "Zig", "GDScript", "CoffeeScript", "ABAP", "Apex",
    "SAS", "Stata", "VHDL", "Verilog",

    // --- Extended Frontend ---
    "Preact", "jQuery", "htmx", "Alpine.js", "Ember.js", "Backbone.js", "Lit", "Qwik",
    "Ionic", "Cordova", "Expo", "Bulma", "Semantic UI", "PrimeNG", "AG Grid",
    "Highcharts", "D3.js", "Chart.js", "Recharts", "ECharts", "ApexCharts",
    "Leaflet", "Mapbox", "OpenLayers", "Babylon.js", "PixiJS", "Phaser", "Lottie",
    "Framer Motion", "GSAP", "Anime.js", "Styled Components",

    // --- Extended Backend & Databases ---
    "Actix", "Axum", "Rocket", "Gin", "Echo", "Phoenix", "Ktor", "Play Framework",
    "Vert.x", "CakePHP", "CodeIgniter", "Slim", "Yii", "Spring Boot", "Ruby on Rails",
    "Solr", "Memcached", "CouchDB", "Couchbase", "MariaDB", "InfluxDB", "TimescaleDB",
    "ArangoDB", "OrientDB", "Realm", "Firestore", "PlanetScale", "CockroachDB", "TiDB",
    "QuestDB", "ScyllaDB",

    // --- Extended Cloud, DevOps & Build ---
    "EC2", "S3", "GKE", "EKS", "AKS", "Fargate", "CloudFormation", "Route 53",
    "CloudFront", "AWS ECS", "DigitalOcean", "Heroku", "Vercel", "Netlify",
    "Linode", "Cloudflare", "Maven", "Gradle", "CMake", "MSBuild",
    "Bazel", "SCons", "Parcel", "esbuild", "SWC", "Turborepo", "Nx", "Lerna",
    "pnpm", "Yarn", "npm", "Bun", "Deno", "Poetry", "Conda", "pip", "Virtualenv",
    "Vagrant", "Puppet", "SaltStack", "Packer", "HashiCorp Vault", "Consul",
    "Spinnaker", "SonarQube", "Snyk", "Checkmarx", "Veracode", "Burp Suite",
    "Metasploit", "Nessus", "Wireshark", "Kali Linux", "Zabbix", "Nagios", "Icinga",
    "Dynatrace", "AppDynamics", "Kibana", "Logstash", "Fluentd", "Loki", "Jaeger",
    "Zipkin", "HAProxy", "Varnish", "Tomcat", "JBoss", "WildFly", "WebLogic", "Jetty",
    "ActiveMQ", "Celery", "Sidekiq", "DevOps", "SRE", "Rancher", "OpenShift",
    "Istio", "Linkerd", "Envoy", "ZooKeeper", "etcd", "minikube", "Kustomize",
    "Apache Spark", "Apache Pulsar", "Google Workspace",
    "Pulumi", "Podman", "ServiceNow", "Automation", "Orchestration", "Containerization", "Virtualization",

    // --- Extended Data, AI/ML & BI ---
    "Hadoop", "Hive", "Presto", "Trino", "Apache Beam", "Apache Druid", "Airbyte",
    "Dagster", "Prefect", "Kestra", "Kubeflow", "SageMaker", "Azure Machine Learning",
    "Looker", "Looker Studio", "Qlik", "Alteryx", "KNIME", "SSIS", "SSRS",
    "Metaflow", "Weights & Biases", "spaCy", "NLTK", "XGBoost", "LightGBM",
    "CatBoost", "ONNX", "LangGraph", "CrewAI", "AutoGen", "Milvus", "Pinecone",
    "Weaviate", "Qdrant", "FAISS", "Google Gemini", "MicroStrategy", "Excel",
    "Microsoft Excel", "PowerPoint", "Google Sheets", "Airtable", "Smartsheet",
    "Snowplow", "Fivetran", "Segment", "DuckDB", "Polars", "Apache Superset",
    "Metabase", "Cube.js", "Meltano", "Ollama", "vLLM", "ChromaDB",

    // --- Extended Mobile, Testing & QA ---
    ".NET MAUI", "Xamarin", "TestFlight", "Fastlane", "Android Studio", "Appium",
    "XCTest", "Espresso", "Robot Framework", "Cucumber", "Mocha", "Chai",
    "JMeter", "k6", "Gatling", "TestRail",

    // --- Extended Design, PM & Analytics Tools ---
    "Sketch", "Adobe XD", "InVision", "Zeplin", "Framer", "Webflow", "Canva",
    "Balsamiq", "Miro", "Mural", "Asana", "Trello", "Monday.com", "ClickUp",
    "Basecamp", "Linear", "YouTrack", "Productboard", "Pendo", "Amplitude",
    "Mixpanel", "Hotjar", "FullStory", "Optimizely", "VWO", "Google Analytics",
    "GA4", "Adobe Analytics", "Matomo", "SEMrush", "Ahrefs", "Moz", "Sprout Social",
    "Hootsuite", "Marketo", "Pardot", "Mailchimp", "Klaviyo", "Braze",

    // --- CRM, ATS, ERP & Finance (recruitment domain) ---
    "Salesforce", "HubSpot", "Pipedrive", "Zoho", "Dynamics 365", "NetSuite", "SAP",
    "Workday", "BambooHR", "Greenhouse", "Ashby", "Workable", "SmartRecruiters",
    "iCIMS", "Taleo", "Jobvite", "Bullhorn", "ADP", "QuickBooks", "Xero", "Sage",
    "Stripe", "PayPal", "Plaid", "SharePoint",

    // --- Certifications & Compliance ---
    "CISSP", "CISA", "CISM", "CEH", "OSCP", "PMP", "ITIL", "Six Sigma", "GDPR",
    "HIPAA", "PCI DSS", "NIST", "CompTIA Security+", "Microsoft 365",
];

pub static SKILL_ALIASES: &[(&str, &str)] = &[
    ("react.js", "React"),
    ("reactjs", "React"),
    ("next.js", "Next.js"),
    ("nextjs", "Next.js"),
    ("vue.js", "Vue"),
    ("vuejs", "Vue"),
    ("nuxt.js", "Nuxt"),
    ("nuxtjs", "Nuxt"),
    ("angularjs", "Angular"),
    ("angular.js", "Angular"),
    ("sveltekit", "Svelte"),
    ("node.js", "Node.js"),
    ("nodejs", "Node.js"),
    ("node", "Node.js"),
    ("express.js", "Express"),
    ("expressjs", "Express"),
    ("nest.js", "NestJS"),
    ("nestjs", "NestJS"),
    ("fastapi", "FastAPI"),
    ("postgres", "PostgreSQL"),
    ("postgresql", "PostgreSQL"),
    ("k8s", "Kubernetes"),
    ("kubernetes", "Kubernetes"),
    ("golang", "Go"),
    ("amazon web services", "AWS"),
    ("aws lambda", "AWS"),
    ("microsoft azure", "Azure"),
    ("azure devops", "Azure"),
    ("gcp", "Google Cloud"),
    ("google cloud platform", "Google Cloud"),
    ("tailwind", "Tailwind CSS"),
    ("tailwindcss", "Tailwind CSS"),
    ("redux toolkit", "Redux"),
    ("tanstack query", "React Query"),
    ("material ui", "Material UI"),
    ("material-ui", "Material UI"),
    ("mui", "Material UI"),
    ("shadcn ui", "Shadcn UI"),
    ("shadcn/ui", "Shadcn UI"),
    ("shadcn", "Shadcn UI"),
    ("chakra ui", "Chakra UI"),
    ("ant design", "Ant Design"),
    ("wasm", "WebAssembly"),
    ("asp.net core", "ASP.NET"),
    (".net core", "ASP.NET"),
    (".net", "ASP.NET"),
    ("ruby on rails", "Ruby on Rails"),
    ("kafka", "Apache Kafka"),
    ("apache kafka", "Apache Kafka"),
    ("spark", "Apache Spark"),
    ("apache spark", "Apache Spark"),
    ("pyspark", "Apache Spark"),
    ("flink", "Apache Flink"),
    ("apache flink", "Apache Flink"),
    ("airflow", "Apache Airflow"),
    ("apache airflow", "Apache Airflow"),
    ("sklearn", "Scikit-learn"),
    ("scikit learn", "Scikit-learn"),
    ("opencv", "Computer Vision"),
    ("natural language processing", "NLP"),
    ("llm", "Large Language Models"),
    ("llms", "Large Language Models"),
    ("generative ai", "Large Language Models"),
    ("rest api", "REST APIs"),
    ("rest apis", "REST APIs"),
    ("restful", "REST APIs"),
    ("restful apis", "REST APIs"),
    ("protobuf", "Protocol Buffers"),
    ("protocol buffers", "Protocol Buffers"),
    ("socket.io", "WebSockets"),
    ("websocket", "WebSockets"),
    ("websockets", "WebSockets"),
    ("mssql", "Microsoft SQL Server"),
    ("sql server", "Microsoft SQL Server"),
    ("oracle db", "Oracle Database"),
    ("github actions", "GitHub Actions"),
    ("gitlab ci/cd", "GitLab CI"),
    ("gitlab ci", "GitLab CI"),
    ("jira", "Jira"),
    ("confluence", "Confluence"),
    ("figma", "Figma"),
    ("terraform", "Terraform"),
    ("ansible", "Ansible"),
    ("docker", "Docker"),
    ("graphql", "GraphQL"),
    ("apollo graphql", "GraphQL"),
    ("next js", "Next.js"),
    ("nuxt js", "Nuxt"),
    ("three js", "Three.js"),
    ("vue js", "Vue"),
    ("react js", "React"),
    ("node js", "Node.js"),
    ("open ai", "OpenAI"),
    ("chat gpt", "OpenAI"),
    ("chatgpt", "OpenAI"),
    ("gsuite", "Google Workspace"),
    ("google suite", "Google Workspace"),
    ("sfdc", "Salesforce"),
    ("salesforce crm", "Salesforce"),
    ("mongo", "MongoDB"),
    ("ms sql", "Microsoft SQL Server"),
    ("oauth2", "OAuth 2.0"),
    ("oauth 2", "OAuth 2.0"),
    ("json web token", "JWT"),
    ("ci cd", "CI/CD"),
    ("cicd", "CI/CD"),
    ("ci-cd", "CI/CD"),
    ("amazon s3", "S3"),
    ("aws s3", "S3"),
    ("aws ec2", "EC2"),
    ("elastic stack", "Elasticsearch"),
    ("dot net", "ASP.NET"),
    ("python3", "Python"),
    ("plsql", "PL/SQL"),
    ("pl-sql", "PL/SQL"),
    ("tsql", "T-SQL"),
    ("t-sql", "T-SQL"),
    ("servicenow", "ServiceNow"),
    ("superset", "Apache Superset"),
    ("snowflake db", "Snowflake"),
    ("duck db", "DuckDB"),
    ("fivetran", "Fivetran"),
    ("segment", "Segment"),
    ("snowplow", "Snowplow"),
];

pub static BANNED_WORDS: &[&str] = &[
    "leadership", "leader", "leading", "management", "manager", "managing",
    "communication", "communicating", "teamwork", "collaboration", "collaborative",
    "problem solving", "problem-solving", "critical thinking", "analytical", "analysis",
    "strategy", "strategic", "strategic planning", "project management", "time management",
    "organization", "organizational", "mentorship", "mentoring", "coaching",
    "cross-functional", "fast learner", "quick learner", "self starter", "self-motivated",
    "attention to detail", "detail-oriented", "adaptability", "flexibility", "creativity",
    "negotiation", "budgeting", "forecasting", "customer service", "stakeholder management",
    "troubleshooting", "debugging", "optimization", "refactoring", "architecture",
    "engineering", "development", "design", "testing", "implementation", "deployment",
    "maintenance", "integration", "coordination", "presentation", "reporting",
    "multitasking", "work ethic", "efficiency", "execution", "results-oriented",
    "driven", "proactive", "dedicated", "motivated", "innovative", "passionate",
    "reliable", "enthusiastic", "dynamic", "independent", "sprint planning",
    "backlog grooming", "user stories", "lean", "slack", "lever", "agile mindset",
    "experienced", "proficient", "skilled", "familiar", "advanced", "expert",
    "certified", "knowledge", "years", "months", "level", "various", "multiple",
    "spearheaded", "oversaw", "leveraged", "leveraging", "built", "managed",
    "directed", "achieved", "delivered", "assisted", "supported", "handled",
];

// Ambiguous single words that are safe inside a skills section (or behind a
// context guard) but must NEVER be matched by the body-wide canonical scan.
pub static GUARDED_SKILLS: &[&str] = &["Go", "Swift", "C", "R", "Flask"];

// Section-token canonicalization vocabulary = body vocabulary + guarded words.
pub static COMMON_SKILLS: LazyLock<Vec<String>> = LazyLock::new(|| {
    let mut all: Vec<String> = CANONICAL_PRIMARY_SKILLS.iter().map(|s| s.to_string()).collect();
    all.extend(GUARDED_SKILLS.iter().map(|s| s.to_string()));
    all
});

const SLASH_PRESERVE: &[&str] = &["ci/cd", "c/c++", "c/c#", "ui/ux", "pl/sql", "tcp/ip"];

/// Split "Node.js/Express" but keep compounds like "CI/CD" or "PL/SQL" intact.
fn split_slash_token(token: &str) -> Vec<String> {
    if !token.contains('/') || SLASH_PRESERVE.contains(&token.to_lowercase().as_str()) {
        return vec![token.to_string()];
    }
    let parts: Vec<String> = token.split('/').map(|p| p.trim().to_string()).collect();
    if parts.iter().all(|p| p.chars().count() >= 2) {
        parts
    } else {
        vec![token.to_string()]
    }
}

#[tauri::command]
pub async fn parse_resume_text(
    _app: AppHandle,
    text: String,
    filename: Option<String>,
    embedded_links: Option<Vec<String>>,
) -> Result<ExtractedCandidateProfile, String> {
    if text.trim().is_empty() {
        return Err("Pasted resume text is empty".into());
    }

    let links = embedded_links.unwrap_or_default();
    let profile = extract_profile_from_text(&text, filename.as_deref(), &links);
    Ok(sanitize_and_verify_profile(profile, &text))
}

pub fn extract_profile_from_text(
    raw: &str,
    filename: Option<&str>,
    embedded_links: &[String],
) -> ExtractedCandidateProfile {
    let clean_text = raw.replace("\r\n", "\n");
    let lines: Vec<&str> = clean_text
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();

    // 1. Email extraction: check embedded mailto links first, then RFC 5322 regex in text
    let mut email = None;
    for link in embedded_links {
        if link.get(..7).is_some_and(|p| p.eq_ignore_ascii_case("mailto:")) {
            let address = link[7..].split('?').next().unwrap_or("").trim();
            if RE_EMAIL.is_match(address) {
                email = Some(address.to_string());
                break;
            }
        }
    }
    if email.is_none() {
        email = RE_EMAIL.find(&clean_text).map(|m| {
            let s = m.as_str().trim();
            s.trim_end_matches(&['.', ',', ';', ')', ']'][..]).to_string()
        });
    }

    // 2. Phone extraction (validated against false-positive years e.g. 2018-2022)
    let phone = RE_PHONE
        .find_iter(&clean_text)
        .map(|m| m.as_str().trim().to_string())
        .find(|p| is_valid_phone(p));

    // 3. LinkedIn URL extraction: check embedded links first, then regex in text
    let mut linkedin_url = None;
    for link in embedded_links {
        if link.to_lowercase().contains("linkedin.com/in/") {
            linkedin_url = Some(clean_linkedin_url(link));
            break;
        }
    }
    if linkedin_url.is_none() {
        linkedin_url = RE_LINKEDIN.find(&clean_text).map(|m| clean_linkedin_url(m.as_str()));
    }

    // 4. Candidate Name Extraction (Multi-Signal Scoring Engine)
    let name = extract_candidate_name(&lines, filename);

    // 5. Current Role / Title Extraction (Dual-Zone: Header Headline + Experience Anchor)
    let current_role = extract_candidate_role(&lines, &name);

    // 6. Comprehensive Location Extraction
    let location = extract_location_from_text(&lines, &clean_text);

    // 7. Experience Years Extraction
    let experience_years = extract_experience_years(&clean_text);

    // 8. High-Accuracy Skills Extraction (Curated Taxonomy + Section-Aware Parser + Context Guards)
    let clean_text_lower = clean_text.to_lowercase();
    let mut detected_skills: Vec<String> = Vec::new();

    let add_skill = |name: &str, list: &mut Vec<String>| {
        let trimmed = name.trim();
        if !trimmed.is_empty() && !list.iter().any(|d| d.eq_ignore_ascii_case(trimmed)) {
            list.push(trimmed.to_string());
        }
    };

    // A. Priority 1: Extract from dedicated "Skills & Technologies" section (Authoritative List)
    let section_tokens = extract_skills_section_tokens(&lines);
    let in_skills_section = !section_tokens.is_empty();

    for token in section_tokens {
        let lower = token.to_lowercase();

        // 1. Check alias mapping first
        if let Some(&(_, canonical)) = SKILL_ALIASES.iter().find(|(a, _)| *a == lower) {
            add_skill(canonical, &mut detected_skills);
            continue;
        }

        // 2. Check canonical list first
        if let Some(canonical) = COMMON_SKILLS.iter().find(|s| s.to_lowercase() == lower) {
            add_skill(canonical, &mut detected_skills);
            continue;
        }

        // 3. Reject soft-skill buzzwords and junk prose
        if is_banned_skill(&lower) {
            continue;
        }

        // 4. Contextual skills in section
        if lower == "swift" {
            if let Some(s) = check_swift_tech(&clean_text_lower, true) {
                add_skill(s, &mut detected_skills);
                continue;
            }
        }
        if lower == "go" || lower == "golang" {
            if let Some(s) = check_go_tech(&clean_text_lower, true) {
                add_skill(s, &mut detected_skills);
                continue;
            }
        }
        if lower == "spring" || lower == "spring boot" {
            if let Some(s) = check_spring_tech(&clean_text_lower) {
                add_skill(s, &mut detected_skills);
                continue;
            }
        }
        if lower == "spark" || lower == "pyspark" {
            if let Some(s) = check_spark_tech(&clean_text_lower) {
                add_skill(s, &mut detected_skills);
                continue;
            }
        }
        if lower == "flask" {
            if let Some(s) = check_flask_tech(&clean_text_lower, true) {
                add_skill(s, &mut detected_skills);
                continue;
            }
        }
        if lower == "c" {
            if let Some(s) = check_c_tech(&clean_text_lower, true) {
                add_skill(s, &mut detected_skills);
                continue;
            }
        }
        if lower == "r" {
            if let Some(s) = check_r_tech(&clean_text_lower, true) {
                add_skill(s, &mut detected_skills);
                continue;
            }
        }

        // 5. Trusted custom tech token: inside a skills section the candidate
        //    wrote it, so unless it's junk prose it's a skill (long-tail coverage).
        if is_valid_section_token(&token) {
            add_skill(&token, &mut detected_skills);
        }
    }

    // B. Priority 2: Unambiguous canonical primary skills scanned across resume body
    for &skill in CANONICAL_PRIMARY_SKILLS {
        let skill_lower = skill.to_lowercase();
        if contains_skill_word(&clean_text_lower, &skill_lower) {
            add_skill(skill, &mut detected_skills);
        }
    }

    // C. Priority 3: Check aliases across resume body
    for &(alias, canonical) in SKILL_ALIASES {
        if contains_skill_word(&clean_text_lower, alias) {
            add_skill(canonical, &mut detected_skills);
        }
    }

    // D. Priority 4: Context-Guarded Skills Evaluation
    if let Some(s) = check_spring_tech(&clean_text_lower) {
        add_skill(s, &mut detected_skills);
    }
    if let Some(s) = check_swift_tech(&clean_text_lower, in_skills_section) {
        add_skill(s, &mut detected_skills);
    }
    if let Some(s) = check_go_tech(&clean_text_lower, in_skills_section) {
        add_skill(s, &mut detected_skills);
    }
    if let Some(s) = check_spark_tech(&clean_text_lower) {
        add_skill(s, &mut detected_skills);
    }
    if let Some(s) = check_flask_tech(&clean_text_lower, in_skills_section) {
        add_skill(s, &mut detected_skills);
    }
    if let Some(s) = check_rails_tech(&clean_text_lower, in_skills_section) {
        add_skill(s, &mut detected_skills);
    }
    if let Some(s) = check_c_tech(&clean_text_lower, in_skills_section) {
        add_skill(s, &mut detected_skills);
    }
    if let Some(s) = check_r_tech(&clean_text_lower, in_skills_section) {
        add_skill(s, &mut detected_skills);
    }

    ExtractedCandidateProfile {
        name,
        email,
        phone,
        current_role,
        experience_years,
        skills: detected_skills,
        location,
        linkedin_url,
        notes_summary: None,
    }
}

/// Normalizes LinkedIn URLs by ensuring https://, stripping tracking query params and trailing slashes
fn clean_linkedin_url(raw: &str) -> String {
    let mut cleaned = raw.trim().to_string();
    if let Some(q_idx) = cleaned.find('?') {
        cleaned = cleaned[..q_idx].to_string();
    }
    cleaned = cleaned.trim_end_matches('/').to_string();
    if !cleaned.starts_with("http://") && !cleaned.starts_with("https://") {
        cleaned = format!("https://{}", cleaned);
    }
    cleaned
}

/// Extracts candidate name using multi-signal scoring (filename anchor, stopword filter, capitalization, positioning)
fn extract_candidate_name(lines: &[&str], filename: Option<&str>) -> String {
    // 1. Extract semantic name tokens from filename if available (e.g. "alex_rivera_resume.pdf" -> ["alex", "rivera"])
    let mut filename_tokens: Vec<String> = Vec::new();
    if let Some(fname) = filename {
        let base = fname.split('.').next().unwrap_or(fname).to_lowercase();
        let noise = [
            "resume", "cv", "curriculum", "vitae", "profile", "updated", "latest", "draft",
            "v1", "v2", "final", "2023", "2024", "2025", "2026", "software", "engineer", "dev",
        ];
        for part in base.split(&['-', '_', ' ', '.'][..]) {
            let trimmed = part.trim();
            if trimmed.len() >= 2 && !noise.contains(&trimmed) && !trimmed.chars().any(|c| c.is_ascii_digit()) {
                filename_tokens.push(trimmed.to_string());
            }
        }
    }

    let section_headers = [
        "summary", "profile", "objective", "experience", "work experience",
        "professional experience", "employment", "education", "skills",
        "certifications", "projects", "contact", "curriculum vitae", "resume",
        "references", "portfolio",
    ];

    let mut best_name = "New Candidate".to_string();
    let mut highest_score = -100i32;

    for (i, line) in lines.iter().take(8).enumerate() {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();

        // Immediate Disqualifiers for Name
        if trimmed.is_empty()
            || trimmed.contains('@')
            || trimmed.contains("http")
            || trimmed.contains("www.")
            || trimmed.contains("linkedin.com")
            || trimmed.contains("github.com")
            || trimmed.contains(".com")
            || trimmed.contains(".org")
            || trimmed.contains(".net")
            || trimmed.chars().any(|c| c.is_ascii_digit())
            || section_headers.iter().any(|h| lower == *h || lower.starts_with(&format!("{}:", h)))
            || lower.contains("curriculum vitae")
            || lower.contains("page ")
            || lower.starts_with("phone:")
            || lower.starts_with("email:")
            || lower.starts_with("address:")
            || lower.starts_with("location:")
        {
            continue;
        }

        // Handle compound header line: "Alex Rivera | Senior Frontend Architect"
        let candidate_part = if trimmed.contains('|') || trimmed.contains('–') || trimmed.contains('—') || trimmed.contains(" - ") {
            let parts: Vec<&str> = trimmed
                .split(&['|', '–', '—'][..])
                .flat_map(|p| p.split(" - "))
                .map(|p| p.trim())
                .filter(|p| !p.is_empty())
                .collect();
            parts.first().copied().unwrap_or(trimmed)
        } else {
            trimmed
        };

        let words: Vec<&str> = candidate_part.split_whitespace().collect();
        let word_count = words.len();

        // Names are typically 2 to 4 words
        if !(2..=4).contains(&word_count) {
            continue;
        }

        if candidate_part.len() < 3 || candidate_part.len() > 35 {
            continue;
        }

        let mut score = 0i32;

        // Signal A: Line position (names are usually at the very top)
        if i == 0 {
            score += 40;
        } else if i == 1 {
            score += 25;
        } else if i == 2 {
            score += 15;
        }

        // Signal B: Filename token match (huge boost if matching file name)
        if !filename_tokens.is_empty() {
            let cand_lower = candidate_part.to_lowercase();
            let mut matches = 0;
            for token in &filename_tokens {
                if cand_lower.contains(token) {
                    matches += 1;
                }
            }
            if matches >= 2 {
                score += 100;
            } else if matches == 1 {
                score += 50;
            }
        }

        // Signal C: Capitalization (Title Case or ALL CAPS)
        let is_title_cased = words.iter().all(|w| {
            let mut chars = w.chars();
            chars.next().map_or(false, |c| c.is_uppercase())
        });
        let is_all_caps = candidate_part.chars().all(|c| !c.is_alphabetic() || c.is_uppercase());

        if is_title_cased || is_all_caps {
            score += 25;
        }

        // Signal D: Avoid common role nouns as names
        let role_words = ["engineer", "developer", "designer", "architect", "manager", "lead", "specialist"];
        if role_words.iter().any(|r| lower.contains(r)) {
            score -= 50;
        }

        if score > highest_score {
            highest_score = score;
            best_name = candidate_part.to_string();
        }
    }

    best_name
}

/// Extracts current role / title using dual-zone strategy:
/// 1. Top headline directly under candidate name
/// 2. First job entry under EXPERIENCE / WORK HISTORY
fn extract_candidate_role(lines: &[&str], candidate_name: &str) -> Option<String> {
    let title_keywords = [
        "engineer", "developer", "architect", "manager", "lead", "designer",
        "recruiter", "sourcer", "specialist", "director", "consultant", "analyst",
        "administrator", "vp", "head of", "officer", "coordinator", "talent",
        "programmer", "scientist", "executive", "associate", "intern", "supervisor",
        "technician", "auditor", "strategist", "representative", "counsel", "accountant",
        "sme", "devops", "platform", "full stack", "frontend", "backend",
    ];

    let name_lower = candidate_name.to_lowercase();

    // Zone 1: Scan top 8 lines for headline (lines directly under Name)
    for line in lines.iter().take(8) {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();

        if lower == name_lower || trimmed.contains('@') || trimmed.contains("http") || trimmed.contains("linkedin.com") {
            continue;
        }

        // Handle compound header line: "Alex Rivera | Senior Frontend Architect" or "Deion Smith – Platform SME"
        let target_role_str = if lower.starts_with(&name_lower) {
            // Lowercasing can change byte length (e.g. 'İ'), so never slice by
            // candidate_name.len(); strip the literal prefix, else skip by chars.
            let remainder = match trimmed.strip_prefix(candidate_name) {
                Some(r) => r,
                None => trimmed
                    .char_indices()
                    .nth(name_lower.chars().count())
                    .map(|(i, _)| &trimmed[i..])
                    .unwrap_or(""),
            }
            .trim();
            let stripped = remainder.trim_start_matches(&['|', '–', '—', '-', ':'][..]).trim();
            if !stripped.is_empty() {
                stripped
            } else {
                continue;
            }
        } else {
            trimmed
        };
        let target_lower = target_role_str.to_lowercase();

        // Check for explicit prefix: "Title: Senior DevOps Engineer"
        if let Some(cap) = RE_TITLE_PREFIX.captures(target_role_str) {
            if let Some(t_match) = cap.get(2) {
                let val = t_match.as_str().trim();
                if !val.is_empty() && val.len() < 80 {
                    return Some(clean_role_title(val));
                }
            }
        }

        // Check if line contains a recognizable title keyword and is concise
        if title_keywords.iter().any(|k| target_lower.contains(k)) && target_role_str.len() < 80 && !is_likely_location(target_role_str) {
            return Some(clean_role_title(target_role_str));
        }
    }

    // Zone 2: Experience Section Anchor Fallback
    // If no headline was in the header, find the first position under "EXPERIENCE"
    let exp_headers = ["experience", "work experience", "professional experience", "employment history", "work history"];
    let mut in_experience = false;
    let mut exp_lines_checked = 0;

    for line in lines {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();

        if !in_experience {
            if exp_headers.iter().any(|h| lower == *h || lower.starts_with(&format!("{}:", h))) {
                in_experience = true;
            }
            continue;
        }

        exp_lines_checked += 1;
        if exp_lines_checked > 6 {
            break; // Stop after first entry
        }

        if title_keywords.iter().any(|k| lower.contains(k)) && trimmed.len() < 80 {
            return Some(clean_role_title(trimmed));
        }
    }

    None
}

fn is_valid_phone(s: &str) -> bool {
    let mut digit_count = 0;
    let mut d = [0u8; 8];
    for b in s.bytes() {
        if b.is_ascii_digit() {
            if digit_count < 8 {
                d[digit_count] = b - b'0';
            }
            digit_count += 1;
        }
    }
    if !(7..=15).contains(&digit_count) {
        return false;
    }
    // Reject year spans e.g. "2019-2023"
    if digit_count == 8 {
        let y1 = (d[0] as i32) * 1000 + (d[1] as i32) * 100 + (d[2] as i32) * 10 + (d[3] as i32);
        let y2 = (d[4] as i32) * 1000 + (d[5] as i32) * 100 + (d[6] as i32) * 10 + (d[7] as i32);
        if (1970..=2050).contains(&y1) && (1970..=2050).contains(&y2) {
            return false;
        }
    }
    true
}

fn extract_experience_years(text: &str) -> Option<i64> {
    if let Some(cap) = RE_EXPERIENCE_YEARS.captures(text) {
        if let Some(m) = cap.get(1) {
            if let Ok(val) = m.as_str().parse::<i64>() {
                if (1..=50).contains(&val) {
                    return Some(val);
                }
            }
        }
    }
    if let Some(cap) = RE_EXP_COMPACT.captures(text) {
        if let Some(m) = cap.get(1) {
            if let Ok(val) = m.as_str().parse::<i64>() {
                if (1..=50).contains(&val) {
                    return Some(val);
                }
            }
        }
    }
    if let Some(cap) = RE_EXP_LEADING.captures(text) {
        if let Some(m) = cap.get(1) {
            if let Ok(val) = m.as_str().parse::<i64>() {
                if (1..=50).contains(&val) {
                    return Some(val);
                }
            }
        }
    }
    None
}

fn extract_skills_section_tokens(lines: &[&str]) -> Vec<String> {
    let mut in_skills_section = false;
    let mut tokens = Vec::new();

    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let lower = trimmed.to_lowercase();
        let is_skills_header = is_skills_heading(trimmed);

        if is_skills_header {
            in_skills_section = true;
            if let Some(idx) = trimmed.find(':') {
                let after = trimmed[idx + 1..].trim();
                if !after.is_empty() {
                    parse_skills_line(after, &mut tokens);
                }
            }
            continue;
        }

        if in_skills_section {
            let is_stop = starts_with_heading(&lower, &[
                "experience", "work experience", "professional experience", "employment",
                "education", "projects", "certifications", "summary", "professional summary",
                "career summary", "profile", "objective", "about me", "awards", "honors",
                "publications", "references", "interests", "volunteer", "training",
                "courses", "activities", "declaration", "hobbies", "additional information",
            ]);

            if is_stop {
                break;
            }

            parse_skills_line(trimmed, &mut tokens);
        }
    }
    tokens
}

fn strip_heading_decor(line: &str) -> String {
    let s = line.trim();
    let s = s.trim_start_matches('#').trim();
    let s = s.trim_matches(|c: char| c == '*' || c == '_' || c == '`').trim();
    s.trim_end_matches(':').trim().to_lowercase()
}

/// Fuzzy skills-heading detection: known headings plus short keyword-shaped
/// lines ("My Tech Stack", "## Toolbox"). Sentence-shaped lines are rejected.
fn is_skills_heading(line: &str) -> bool {
    let h = strip_heading_decor(line);
    if h.is_empty() || h.chars().count() > 48 {
        return false;
    }
    const KNOWN: &[&str] = &[
        "technical skills", "core skills", "skills", "skills & tools", "skills and tools",
        "skills & technologies", "skills and technologies", "technologies", "core competencies",
        "technical proficiencies", "tools & technologies", "languages & frameworks",
        "technical toolkit", "tech stack", "my stack", "the stack", "stack", "toolbox",
        "toolkit", "key skills", "key technologies", "areas of expertise", "expertise",
        "technical expertise", "core technologies", "technology", "technical background",
        "core technical skills", "professional skills", "technical tooling", "tools",
        "development tools", "platforms", "ecosystem", "my tech stack", "my toolbox",
        "my toolkit", "my tools", "my core skills", "our tech stack", "our stack",
    ];
    if KNOWN.iter().any(|k| *k == h) {
        return true;
    }
    const KW: &[&str] = &[
        "skill", "tool", "stack", "technolog", "competenc", "keyword", "arsenal",
        "expertis", "proficienc", "capabilit",
    ];
    if !KW.iter().any(|k| h.contains(k)) {
        return false;
    }
    if h.split(' ').count() > 6 || h.ends_with('.') || h.chars().any(|c| c.is_ascii_digit()) {
        return false;
    }
    const SENTENCE_JUNK: &[&str] = &[
        "used", "build", "built", "working", "helped", "years", "across", "etc",
        "have", "has", "was", "were", "this", "these", "know", "knows", "daily",
        "role", "team", "work", "worked",
    ];
    !h.split_whitespace().any(|w| SENTENCE_JUNK.contains(&w))
}

fn starts_with_heading(lower: &str, headings: &[&str]) -> bool {
    headings.iter().any(|h| lower.starts_with(h))
}

fn parse_skills_line(line: &str, tokens: &mut Vec<String>) {
    let content = if let Some(idx) = line.find(':') {
        let prefix = line[..idx].trim().to_lowercase();
        if is_category_prefix(&prefix) {
            line[idx + 1..].trim()
        } else {
            line
        }
    } else {
        line
    };

    for part in content.split(&[',', ';', '|', '•', '·', '▪', '▫', '★', '♦', '\t'][..]) {
        // Don't word-split inside parentheses: "AWS (EC2 and S3)"
        let pieces: Vec<&str> = if part.contains('(') {
            vec![part]
        } else {
            part.split(" and ")
                .flat_map(|p| p.split(" & "))
                .flat_map(|p| p.split(" AND "))
                .collect()
        };
        for piece in pieces {
            let raw_token = piece.trim().trim_start_matches(['-', '*', '>', '•', '·', ' ']);
            if raw_token.is_empty() {
                continue;
            }

            if let Some(open_paren) = raw_token.find('(') {
                let main_part = raw_token[..open_paren].trim();
                if !main_part.is_empty() {
                    for s in split_slash_token(main_part) {
                        let cleaned = clean_skill_token(&s);
                        if !cleaned.is_empty() {
                            tokens.push(cleaned);
                        }
                    }
                }
                if let Some(close_paren) = raw_token.find(')') {
                    if close_paren > open_paren + 1 {
                        let inside = &raw_token[open_paren + 1..close_paren];
                        for sub in inside.split(&[',', '/', ' '][..]) {
                            let clean_sub = clean_skill_token(sub);
                            if !clean_sub.is_empty() {
                                tokens.push(clean_sub);
                            }
                        }
                    }
                }
            } else {
                for s in split_slash_token(raw_token) {
                    let cleaned = clean_skill_token(&s);
                    if !cleaned.is_empty() {
                        tokens.push(cleaned);
                    }
                }
            }
        }
    }
}

/// Category prefix on a skills line: "Languages: …", "AI: …". Two-letter keys
/// ("ai", "ml") require an exact word match so "Email:" never qualifies.
fn is_category_prefix(prefix: &str) -> bool {
    const KEYWORDS: &[&str] = &[
        "language", "framework", "database", "cloud", "devop", "tool", "platform",
        "librar", "frontend", "backend", "methodolog", "storage", "testing",
        "infrastructure", "data", "secur", "analytic", "mobile", "web", "script",
        "operat", "monitor", "messag", "build", "science", "tooling", "programming",
        "big data", "visualization", "ml ops", "mlops",
    ];
    const SHORT: &[&str] = &["ai", "ml"];
    if prefix
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .any(|w| SHORT.contains(&w))
    {
        return true;
    }
    KEYWORDS.iter().any(|k| prefix.contains(k))
}

fn clean_skill_token(token: &str) -> String {
    let trimmed = token
        .trim()
        .trim_matches(&['(', ')', '[', ']', '{', '}', '"', '\'', '.', ':', ',', ';'][..]);
    let mut parts: Vec<&str> = trimmed.split_whitespace().collect();

    // Strip leading proficiency words: "Advanced Python", "Knowledge of React"
    while parts.len() > 1
        && (PROFICIENCY_LEAD.contains(&parts[0].to_lowercase().as_str())
            || matches!(parts[0], "in" | "with" | "of"))
    {
        parts.remove(0);
    }

    if parts.len() == 2 {
        let second = parts[1];
        if second.chars().next().map_or(false, |c| c.is_ascii_digit())
            || second.starts_with('v')
            || second.starts_with('V')
        {
            return parts[0].to_string();
        }
    }
    parts.join(" ")
}

fn is_banned_skill(lower_token: &str) -> bool {
    let trimmed = lower_token.trim().trim_matches(&['-', '*', '•', '·', ' ', '.', ':'][..]);
    if trimmed.is_empty() || trimmed.len() < 2 {
        return true;
    }

    if BANNED_WORDS.iter().any(|b| *b == trimmed) {
        return true;
    }

    if trimmed.len() > 5 {
        if trimmed.ends_with("ing")
            || trimmed.ends_with("ed")
            || trimmed.ends_with("tion")
            || trimmed.ends_with("ment")
            || trimmed.ends_with("ness")
            || trimmed.ends_with("able")
            || trimmed.ends_with("ible")
            || trimmed.ends_with("ship")
        {
            let allowed_exceptions = [
                "machine learning", "deep learning", "penetration testing", "testing",
                "spring", "spring boot", "ansible", "kotlin", "redis",
                "automation", "orchestration", "containerization", "virtualization",
                "cloudformation", "segment", "scripting", "data mining", "threat modeling",
            ];
            if !allowed_exceptions.iter().any(|e| *e == trimmed) {
                return true;
            }
        }
    }

    false
}

static PROFICIENCY_LEAD: &[&str] = &[
    "advanced", "expert", "proficient", "skilled", "experienced", "strong", "solid",
    "deep", "hands-on", "handson", "extensive", "working", "familiar", "mastery",
    "beginner", "intermediate", "knowledge", "good", "basic", "hands",
];

/// Junk filter for tokens found inside a trusted skills section. The section is
/// authoritative — this only removes prose, contact info, spoken languages and
/// work-arrangement words, never unknown tech names.
fn is_valid_section_token(token: &str) -> bool {
    let t = token.trim();
    let count = t.chars().count();
    if count < 2 || count > 40 {
        return false;
    }
    if t.split_whitespace().count() > 4 {
        return false;
    }
    if t.contains('@') || t.contains("://") {
        return false;
    }
    if t.chars().next().map_or(false, |c| c.is_ascii_digit()) {
        return false;
    }
    if !t.chars().any(|c| c.is_alphanumeric()) {
        return false;
    }
    if t
        .chars()
        .all(|c| c.is_ascii_digit() || matches!(c, '.' | '-' | '+' | '/' | '#' | ':'))
    {
        return false;
    }
    let lower = t.to_lowercase();
    if lower.contains("experience") || lower.contains(" years") {
        return false;
    }
    !SECTION_JUNK.iter().any(|j| *j == lower)
}

static SECTION_JUNK: &[&str] = &[
    // Spoken languages (belong on a profile, not a tech list)
    "english", "hindi", "spanish", "french", "german", "italian", "portuguese",
    "mandarin", "cantonese", "tamil", "telugu", "marathi", "urdu", "arabic",
    "japanese", "korean", "russian", "punjabi", "bengali", "gujarati", "kannada",
    "malayalam", "native", "fluent",
    // Work arrangement / contract terms
    "remote", "hybrid", "onsite", "on-site", "w2", "c2c", "1099", "full-time",
    "full time", "part-time", "contract", "visa",
    // Splitter leftovers
    "and", "or", "with", "plus", "etc",
];

pub(crate) fn check_spring_tech(text_lower: &str) -> Option<&'static str> {
    if contains_skill_word(text_lower, "spring boot")
        || contains_skill_word(text_lower, "spring cloud")
        || contains_skill_word(text_lower, "spring framework")
        || contains_skill_word(text_lower, "spring mvc")
        || contains_skill_word(text_lower, "spring security")
        || contains_skill_word(text_lower, "spring data")
        || contains_skill_word(text_lower, "spring batch")
    {
        return Some("Spring Boot");
    }

    let mut start = 0;
    while let Some(pos) = text_lower[start..].find("spring") {
        let idx = start + pos;
        let end_idx = idx + 6;

        let left_bound = if idx == 0 {
            true
        } else {
            let prev = text_lower[..idx].chars().next_back().unwrap();
            !prev.is_alphanumeric() && prev != '#' && prev != '+'
        };

        let right_bound = if end_idx >= text_lower.len() {
            true
        } else {
            let next = text_lower[end_idx..].chars().next().unwrap();
            !next.is_alphanumeric() && next != '#' && next != '+'
        };

        if left_bound && right_bound {
            let lookahead = if end_idx < text_lower.len() {
                let after = &text_lower[end_idx..];
                // get(..30) returns None on a char boundary miss instead of panicking
                after.get(..30).unwrap_or(after)
            } else {
                ""
            };

            let is_calendar_date = lookahead.starts_with(" 20")
                || lookahead.starts_with(" '2")
                || lookahead.starts_with(" 19")
                || lookahead.starts_with(" '1")
                || lookahead.starts_with(" semester")
                || lookahead.starts_with(" quarter")
                || lookahead.starts_with(" term")
                || lookahead.starts_with(" break")
                || lookahead.starts_with(" graduation");

            if !is_calendar_date {
                let has_java_context = contains_skill_word(text_lower, "java")
                    || contains_skill_word(text_lower, "hibernate")
                    || contains_skill_word(text_lower, "jvm")
                    || contains_skill_word(text_lower, "maven")
                    || contains_skill_word(text_lower, "gradle")
                    || contains_skill_word(text_lower, "jpa")
                    || contains_skill_word(text_lower, "micronaut")
                    || contains_skill_word(text_lower, "quarkus");

                if has_java_context {
                    return Some("Spring Boot");
                }
            }
        }

        start = idx + 6;
        if start >= text_lower.len() {
            break;
        }
    }

    None
}

fn check_swift_tech(text_lower: &str, in_skills_section: bool) -> Option<&'static str> {
    if !contains_skill_word(text_lower, "swift") {
        return None;
    }

    if text_lower.contains("swift action")
        || text_lower.contains("swift response")
        || text_lower.contains("swift resolution")
        || text_lower.contains("swift turnaround")
        || text_lower.contains("swift pace")
    {
        let has_mobile = contains_skill_word(text_lower, "ios")
            || contains_skill_word(text_lower, "swiftui")
            || contains_skill_word(text_lower, "xcode");
        if !has_mobile {
            return None;
        }
    }

    if in_skills_section {
        return Some("Swift");
    }

    let has_apple_context = contains_skill_word(text_lower, "ios")
        || contains_skill_word(text_lower, "swiftui")
        || contains_skill_word(text_lower, "xcode")
        || contains_skill_word(text_lower, "objective-c")
        || contains_skill_word(text_lower, "macos")
        || contains_skill_word(text_lower, "cocoa")
        || contains_skill_word(text_lower, "app store")
        || contains_skill_word(text_lower, "testflight");

    if has_apple_context {
        Some("Swift")
    } else {
        None
    }
}

fn check_go_tech(text_lower: &str, in_skills_section: bool) -> Option<&'static str> {
    if contains_skill_word(text_lower, "golang") {
        return Some("Go");
    }

    if !contains_skill_word(text_lower, "go") {
        return None;
    }

    if in_skills_section {
        return Some("Go");
    }

    let patterns = [
        "go, python", "python, go", "go/python", "python/go",
        "go, rust", "rust, go", "go/rust", "rust/go",
        "go, java", "java, go", "go/java", "java/go",
        "go, c++", "c++, go", "go, typescript", "typescript, go",
        "go (golang)", "go language", "go developer", "go engineer",
        "go backend", "go microservices", "go programming",
    ];

    if patterns.iter().any(|p| text_lower.contains(p)) {
        return Some("Go");
    }

    None
}

fn check_spark_tech(text_lower: &str) -> Option<&'static str> {
    if contains_skill_word(text_lower, "apache spark") || contains_skill_word(text_lower, "pyspark") {
        return Some("Apache Spark");
    }

    if !contains_skill_word(text_lower, "spark") {
        return None;
    }

    if text_lower.contains("sparked") || text_lower.contains("sparking") || text_lower.contains("spark idea") {
        return None;
    }

    let has_big_data = contains_skill_word(text_lower, "hadoop")
        || contains_skill_word(text_lower, "kafka")
        || contains_skill_word(text_lower, "databricks")
        || contains_skill_word(text_lower, "hive")
        || contains_skill_word(text_lower, "flink")
        || contains_skill_word(text_lower, "airflow")
        || contains_skill_word(text_lower, "etl")
        || contains_skill_word(text_lower, "scala")
        || text_lower.contains("big data")
        || text_lower.contains("data pipeline");

    if has_big_data {
        Some("Apache Spark")
    } else {
        None
    }
}

fn check_flask_tech(text_lower: &str, in_skills_section: bool) -> Option<&'static str> {
    if !contains_skill_word(text_lower, "flask") {
        return None;
    }

    if in_skills_section {
        return Some("Flask");
    }

    let has_python = contains_skill_word(text_lower, "python")
        || contains_skill_word(text_lower, "django")
        || contains_skill_word(text_lower, "fastapi")
        || contains_skill_word(text_lower, "sqlalchemy")
        || contains_skill_word(text_lower, "jinja")
        || contains_skill_word(text_lower, "celery")
        || contains_skill_word(text_lower, "pytest")
        || contains_skill_word(text_lower, "pandas");

    if has_python {
        Some("Flask")
    } else {
        None
    }
}

fn check_rails_tech(text_lower: &str, in_skills_section: bool) -> Option<&'static str> {
    if contains_skill_word(text_lower, "ruby on rails") {
        return Some("Ruby on Rails");
    }

    if contains_skill_word(text_lower, "rails") {
        if in_skills_section || contains_skill_word(text_lower, "ruby") {
            return Some("Ruby on Rails");
        }
    }

    None
}

fn check_c_tech(text_lower: &str, in_skills_section: bool) -> Option<&'static str> {
    let c_patterns = [
        "c/c++", "c / c++", "c, c++", "c & c++", "c and c++",
        "c programming", "ansi c", "embedded c",
    ];

    if c_patterns.iter().any(|p| text_lower.contains(p)) {
        return Some("C");
    }

    if in_skills_section {
        if text_lower.contains("c++") || text_lower.contains("python") || text_lower.contains("java") {
            if contains_skill_word(text_lower, "c") {
                return Some("C");
            }
        }
    }

    None
}

fn check_r_tech(text_lower: &str, in_skills_section: bool) -> Option<&'static str> {
    let r_patterns = [
        "r programming", "r script", "r language", "rstudio",
        "python/r", "r/python", "python and r", "r and python",
        "ggplot2", "dplyr", "tidyverse",
    ];

    if r_patterns.iter().any(|p| text_lower.contains(p)) {
        return Some("R");
    }

    if in_skills_section {
        if text_lower.contains("python, r") || text_lower.contains("r, python") || text_lower.contains("sql, r") {
            return Some("R");
        }
    }

    None
}

fn contains_skill_word(h_lower: &str, s_lower: &str) -> bool {
    let mut start = 0;
    while let Some(pos) = h_lower[start..].find(s_lower) {
        let idx = start + pos;
        let end_idx = idx + s_lower.len();

        let left_bound = if idx == 0 {
            true
        } else {
            let prev = h_lower[..idx].chars().next_back().unwrap();
            !prev.is_alphanumeric() && prev != '#' && prev != '+'
        };

        let right_bound = if end_idx >= h_lower.len() {
            true
        } else {
            let next = h_lower[end_idx..].chars().next().unwrap();
            !next.is_alphanumeric() && next != '#' && next != '+'
        };

        if left_bound && right_bound {
            if s_lower == "go" {
                let remainder = &h_lower[end_idx..];
                if remainder.starts_with(" to market")
                    || remainder.starts_with("-to-market")
                    || remainder.starts_with(" to-market")
                    || remainder.starts_with(" back")
                    || remainder.starts_with(" forward")
                {
                    start = idx + s_lower.len();
                    if start >= h_lower.len() {
                        break;
                    }
                    continue;
                }
            }
            return true;
        }

        start = idx + s_lower.len();
        if start >= h_lower.len() {
            break;
        }
    }
    false
}

fn clean_role_title(title: &str) -> String {
    let mut cleaned = title.to_string();
    // Strip company or dates if joined with separators: "Senior Software Engineer | Google" or "Lead Recruiter — Acme"
    for sep in &["|", "—", "–", " at ", " @ "] {
        if let Some(idx) = cleaned.find(sep) {
            cleaned = cleaned[..idx].trim().to_string();
        }
    }
    // Strip trailing dates e.g. "(2021 - Present)" or "2021 - 2024"
    if let Some(idx) = cleaned.find('(') {
        cleaned = cleaned[..idx].trim().to_string();
    }
    cleaned
}

fn is_likely_location(text: &str) -> bool {
    let lower = text.to_lowercase();
    if lower.contains("remote") || lower.contains("area") || lower.contains("city") || lower.contains("metro") {
        return true;
    }
    RE_US_STATE.is_match(text)
}

fn extract_location_from_text(lines: &[&str], full_text: &str) -> Option<String> {
    // A. Check for explicit location prefixes: "Location: Austin, TX"
    if let Some(cap) = RE_EXPLICIT_LOC.captures(full_text) {
        if let Some(loc) = cap.get(2) {
            let loc_str = loc.as_str().trim();
            if !loc_str.is_empty() && loc_str.len() < 60 {
                return Some(loc_str.to_string());
            }
        }
    }

    // B. Check top 8 lines (header section) by splitting contact lines:
    for line in lines.iter().take(8) {
        let tokens: Vec<&str> = line.split(&['|', '•', '·', ';'][..]).map(|t| t.trim()).collect();
        for token in tokens {
            if token.contains('@') || token.contains("http") || token.contains("linkedin.com") {
                continue;
            }

            if let Some(cap) = RE_US_CITY_STATE.captures(token) {
                if let Some(m) = cap.get(0) {
                    return Some(m.as_str().trim().to_string());
                }
            }

            if let Some(cap) = RE_FULL_STATE.captures(token) {
                if let Some(m) = cap.get(0) {
                    return Some(m.as_str().trim().to_string());
                }
            }

            let lower = token.to_lowercase();
            if (lower.contains("remote") || lower.contains("area") || lower.contains("greater ")) && token.len() < 50 && token.len() > 3 {
                return Some(token.to_string());
            }
        }
    }

    // C. Fallback scan across full text for standard "City, State"
    if let Some(cap) = RE_US_CITY_STATE.captures(full_text) {
        if let Some(m) = cap.get(0) {
            let s = m.as_str().trim();
            if s.len() < 50 {
                return Some(s.to_string());
            }
        }
    }

    None
}

fn sanitize_and_verify_profile(
    mut profile: ExtractedCandidateProfile,
    source_text: &str,
) -> ExtractedCandidateProfile {
    let lower_source = source_text.to_lowercase();

    // Verify email exists in source text
    if let Some(ref em) = profile.email {
        if !lower_source.contains(&em.to_lowercase()) {
            profile.email = None;
        }
    }

    // Clean empty strings to None
    if let Some(ref loc) = profile.location {
        if loc.trim().is_empty() || loc.to_lowercase() == "n/a" || loc.to_lowercase() == "none" {
            profile.location = None;
        }
    }

    if let Some(ref li) = profile.linkedin_url {
        if li.trim().is_empty() || li.to_lowercase() == "n/a" || li.to_lowercase() == "none" {
            profile.linkedin_url = None;
        }
    }

    if let Some(ref role) = profile.current_role {
        if role.trim().is_empty() || role.to_lowercase() == "n/a" {
            profile.current_role = None;
        }
    }

    // Deduplicate skills
    let mut unique_skills = Vec::new();
    for s in profile.skills {
        let trimmed = s.trim().to_string();
        if !trimmed.is_empty() && !unique_skills.iter().any(|u: &String| u.eq_ignore_ascii_case(&trimmed)) {
            unique_skills.push(trimmed);
        }
    }
    profile.skills = unique_skills;

    profile
}
