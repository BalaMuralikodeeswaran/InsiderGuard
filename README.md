# CaughtIn4K
### Machine Learning-Based Insider Threat Detection System

CaughtIn4K is a web-based cybersecurity application designed to identify potentially suspicious employee behaviour within an organisation. It uses machine learning and behavioural analysis to support the detection of insider threats and provides security teams with tools to monitor activity, review alerts and manage investigations.

The project was developed as an academic cybersecurity project using the CERT Insider Threat Dataset (r3.2).

## Project Overview

Insider threats can arise when employees or other authorised users misuse their access to organisational systems and information. These activities can be difficult to detect because they may occur through legitimate user accounts.

CaughtIn4K analyses employee activity records to identify unusual behavioural patterns. The system combines machine learning results with a risk assessment interface, allowing security personnel to examine suspicious activity and investigate potential threats.

## Key Features

- **Security Dashboard:** Overview of employee activity, alerts and risk indicators.
- **Employee Monitoring:** Employee profiles and behavioural activity information.
- **Machine Learning Analysis:** Anomaly detection using Local Outlier Factor (LOF), with Isolation Forest used for model comparison.
- **Risk Assessment:** Employee risk scores and classifications to support investigation priorities.
- **Security Alerts:** Review of potentially suspicious employee activity.
- **Investigation Management:** Creation, assignment and management of security investigations.
- **Analytics:** Visualisations of model performance and employee activity trends.
- **Reports:** Security reporting interface.
- **Role-Based Access:** Separate Administrator and Security Analyst roles.
- **Log Upload:** Interface for importing supported activity records.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, JavaScript |
| Backend | Python, FastAPI |
| Database | MongoDB |
| Machine Learning | Local Outlier Factor, Isolation Forest |
| API | REST |
| Development Environment | Local computer |

## Dataset

The project uses the Carnegie Mellon University CERT Insider Threat Dataset, version r3.2.

The dataset contains simulated organisational activity records, including:

- User logon and logoff activity
- Email activity
- File access
- Web browsing activity
- Removable device usage
- Employee and organisational information

The processed dataset used in the project contains approximately **338,853 employee-day records**, representing **1,000 employees**, with **31 behavioural features**.

Large dataset files and local database contents are not included in this repository.

## Machine Learning Evaluation

Local Outlier Factor was selected for the final anomaly detection component after comparison with Isolation Forest.

The recorded employee-level evaluation results were:

| Metric | Result |
|---|---|
| Accuracy | 98.2% |
| Precision | 10.0% |
| Recall | 100.0% |
| F1-score | 18.2% |
| False Positive Rate | 1.8% |

These results were obtained using the project's prepared evaluation data. The low precision indicates that false positives remain an important limitation, despite the model identifying both labelled malicious employees in the evaluation.

The application also produces blended employee risk scores, which should not be interpreted as identical to the machine learning model's binary detection results.

## Project Structure

```text
InsiderGuard/
├── backend/             # FastAPI services and ML components
├── frontend/            # React web application
├── tests/               # Project test files
├── test_reports/        # Testing records and outputs
├── README.md            # Project documentation
└── .gitignore           # Git exclusion rules
```

## Local Installation

### Prerequisites

Install the following software:

- Python and pip
- Node.js and Yarn
- MongoDB
- Git

### 1. Clone the Repository

```bash
git clone -b CaughtIn4K-Final https://github.com/BalaMuralikodeeswaran/InsiderGuard.git
cd InsiderGuard
```

### 2. Configure the Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Configure the required environment variables for your local MongoDB connection and application authentication.

Do not commit passwords, database credentials or secret keys to the repository.

### 3. Start the Backend

```bash
uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

The API documentation is available at:

`http://127.0.0.1:8000/docs`

### 4. Install and Start the Frontend

Open another terminal:

```bash
cd frontend
yarn install
yarn start
```

The frontend is normally accessible at:

`http://localhost:3000`

### 5. Access the Application

Open the frontend in a browser and sign in using an account configured in your local database.

The system provides Administrator and Security Analyst roles with different access permissions.

## Testing

The repository includes testing-related files and reports for reviewing application behaviour.

Testing areas include:

- Backend API functionality
- Employee data retrieval
- Authentication and access permissions
- Security alerts and investigations
- Frontend navigation and application workflows
- Machine learning evaluation

## Limitations

The application was developed and evaluated in a local environment using a synthetic insider threat dataset. Its evaluation results should not be treated as evidence of performance in a live organisational network.

The small number of labelled malicious employees and the presence of false positives limit the conclusions that can be drawn from the model's performance. Further validation, risk-score calibration and security testing would be required before production deployment.

## Future Improvements

Potential future developments include real-time activity ingestion, integration with security monitoring platforms, additional evaluation datasets, improved risk-score calibration and more detailed explanations of anomaly detection results.

## Academic Purpose

CaughtIn4K was developed for educational and research purposes. It is intended to demonstrate how behavioural analytics, machine learning and web-based investigation workflows can support insider threat detection.

## License

No open-source licence has been specified for this repository.
