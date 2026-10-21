"""
CaughtIn4K ML Engine
Feature engineering, anomaly detection (Isolation Forest + Local Outlier Factor),
risk scoring, explainable AI, and model evaluation.
"""
import numpy as np
import pandas as pd
from datetime import datetime

from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_curve, auc,
)

# ------------------------- Config -------------------------
WORK_START = 8   # 8 AM
WORK_END = 19    # 7 PM
FEATURE_COLUMNS = [
    # Existing behavioural features
    "offhours_logins",
    "weekend_logins",
    "avg_downloads",
    "max_downloads",
    "avg_uploads",
    "total_failed_logins",
    "external_email_ratio",
    "usb_usage_count",
    "restricted_access_count",
    "distinct_devices",
    "distinct_ips",
    "avg_session_hours",
    "vpn_usage_count",
    "max_external_emails",

    # CaughtIn4K V2 features
    "max_usb_per_day",
    "usb_active_days",
    "usb_file_overlap_days",
    "usb_file_overlap_ratio",

    "total_job_site_visits",
    "max_daily_job_visits",
    "job_activity_days",
    "offhours_job_visits",
    "job_web_ratio",

    "cloud_storage_visits",
    "max_daily_cloud_visits",

    "offhours_web_requests",
    "weekend_web_requests",

    "job_activity_spike",
    "file_activity_spike",
    "usb_activity_spike",
    "external_email_spike",
]

FEATURE_LABELS = {
    "offhours_logins": "Off-hours logins",
    "weekend_logins": "Weekend logins",
    "avg_downloads": "Average file activity",
    "max_downloads": "Peak file activity",
    "avg_uploads": "Average uploads",
    "total_failed_logins": "Failed login attempts",
    "external_email_ratio": "External email ratio",
    "usb_usage_count": "USB device connections",
    "restricted_access_count": "Restricted access",
    "distinct_devices": "Distinct devices",
    "distinct_ips": "Distinct IP addresses",
    "avg_session_hours": "Average session duration",
    "vpn_usage_count": "VPN usage",
    "max_external_emails": "Peak external emails",

    "max_usb_per_day": "Peak daily USB connections",
    "usb_active_days": "USB-active days",
    "usb_file_overlap_days": "USB and file overlap days",
    "usb_file_overlap_ratio": "USB/file overlap ratio",

    "total_job_site_visits": "Job-site visits",
    "max_daily_job_visits": "Peak daily job-site visits",
    "job_activity_days": "Job-site activity days",
    "offhours_job_visits": "Off-hours job-site visits",
    "job_web_ratio": "Job-site browsing ratio",

    "cloud_storage_visits": "Cloud-storage visits",
    "max_daily_cloud_visits": "Peak cloud-storage activity",

    "offhours_web_requests": "Off-hours web requests",
    "weekend_web_requests": "Weekend web requests",

    "job_activity_spike": "Job browsing spike",
    "file_activity_spike": "File activity spike",
    "usb_activity_spike": "USB activity spike",
    "external_email_spike": "External email spike",
}


def _parse_hour(ts):
    try:
        return datetime.fromisoformat(str(ts)).hour
    except Exception:
        try:
            return int(str(ts).split(":")[0])
        except Exception:
            return 9


def _is_weekend(dstr):
    try:
        return datetime.fromisoformat(str(dstr)[:19]).weekday() >= 5
    except Exception:
        return False


def _session_hours(login, logout):
    try:
        a = datetime.fromisoformat(str(login))
        b = datetime.fromisoformat(str(logout))
        h = (b - a).total_seconds() / 3600.0
        return h if h > 0 else 8.0
    except Exception:
        return 8.0


# ------------------------- Feature Engineering -------------------------
def engineer_features(logs):
    """
    CaughtIn4K V2 feature engineering.

    Aggregates daily employee activity and identifies
    cross-channel and behavioural-spike indicators.
    """
    df = pd.DataFrame(logs)

    if df.empty:
        return pd.DataFrame()

    # V2 fields may not exist in older datasets.
    optional_defaults = {
        "web_requests": 0,
        "job_site_visits": 0,
        "cloud_storage_visits": 0,
        "webmail_visits": 0,
        "social_media_visits": 0,
        "offhours_web_requests": 0,
        "weekend_web_requests": 0,
        "offhours_job_visits": 0,
        "usb_file_overlap": 0,
    }

    for col, default in optional_defaults.items():
        if col not in df.columns:
            df[col] = default

    rows = []

    for emp_id, g in df.groupby("employee_id"):

        def num(column):
            return pd.to_numeric(
                g[column],
                errors="coerce"
            ).fillna(0)

        hours = g["login_time"].apply(_parse_hour)

        offhours = int(
            ((hours < WORK_START) | (hours >= WORK_END)).sum()
        )

        weekend = int(
            g["date"].apply(_is_weekend).sum()
        )

        sessions = [
            _session_hours(login, logout)
            for login, logout
            in zip(g["login_time"], g["logout_time"])
        ]

        downloads = num("downloads")
        uploads = num("uploads")

        usb = num("usb_connected")
        usb_overlap = num("usb_file_overlap")

        failed = num("failed_logins")
        restricted = num("restricted_access")
        vpn = num("vpn_usage")

        ext = num("external_emails")
        internal = num("internal_emails")

        web = num("web_requests")
        job = num("job_site_visits")
        cloud = num("cloud_storage_visits")

        offhours_web = num("offhours_web_requests")
        weekend_web = num("weekend_web_requests")
        offhours_job = num("offhours_job_visits")

        total_emails = (
            ext + internal
        ).replace(0, np.nan)

        external_ratio = float(
            (ext / total_emails)
            .fillna(0)
            .mean()
        )

        usb_active_days = int(
            (usb > 0).sum()
        )

        usb_overlap_days = int(
            (usb_overlap > 0).sum()
        )

        usb_overlap_ratio = (
            usb_overlap_days / usb_active_days
            if usb_active_days > 0
            else 0
        )

        total_web = float(web.sum())

        job_web_ratio = (
            float(job.sum()) / total_web
            if total_web > 0
            else 0
        )

        # -------------------------------------------------
        # Behavioural spike features
        # -------------------------------------------------

        job_mean = float(job.mean())
        file_mean = float(downloads.mean())
        usb_mean = float(usb.mean())
        ext_mean = float(ext.mean())

        job_spike = (
            float(job.max()) / (job_mean + 1)
        )

        file_spike = (
            float(downloads.max()) / (file_mean + 1)
        )

        usb_spike = (
            float(usb.max()) / (usb_mean + 0.25)
        )

        ext_spike = (
            float(ext.max()) / (ext_mean + 1)
        )

        # Prevent extreme sparse values dominating scaling
        job_spike = min(job_spike, 50)
        file_spike = min(file_spike, 50)
        usb_spike = min(usb_spike, 50)
        ext_spike = min(ext_spike, 50)

        rows.append({
            "employee_id": emp_id,

            "department":
                g["department"].iloc[0],

            # Existing features
            "offhours_logins":
                offhours,

            "weekend_logins":
                weekend,

            "avg_downloads":
                float(downloads.mean()),

            "max_downloads":
                float(downloads.max()),

            "avg_uploads":
                float(uploads.mean()),

            "total_failed_logins":
                int(failed.sum()),

            "external_email_ratio":
                round(external_ratio, 3),

            "usb_usage_count":
                int(usb.sum()),

            "restricted_access_count":
                int(restricted.sum()),

            "distinct_devices":
                int(g["device"].nunique()),

            "distinct_ips":
                int(g["ip_address"].nunique()),

            "avg_session_hours":
                round(
                    float(np.mean(sessions)),
                    2
                ),

            "vpn_usage_count":
                int(vpn.sum()),

            "max_external_emails":
                float(ext.max()),

            # V2 USB/file correlation
            "max_usb_per_day":
                float(usb.max()),

            "usb_active_days":
                usb_active_days,

            "usb_file_overlap_days":
                usb_overlap_days,

            "usb_file_overlap_ratio":
                round(
                    usb_overlap_ratio,
                    3
                ),

            # V2 job/web behaviour
            "total_job_site_visits":
                int(job.sum()),

            "max_daily_job_visits":
                float(job.max()),

            "job_activity_days":
                int((job > 0).sum()),

            "offhours_job_visits":
                int(offhours_job.sum()),

            "job_web_ratio":
                round(job_web_ratio, 4),

            # V2 cloud behaviour
            "cloud_storage_visits":
                int(cloud.sum()),

            "max_daily_cloud_visits":
                float(cloud.max()),

            # V2 web temporal behaviour
            "offhours_web_requests":
                int(offhours_web.sum()),

            "weekend_web_requests":
                int(weekend_web.sum()),

            # V2 personal behaviour spikes
            "job_activity_spike":
                round(job_spike, 3),

            "file_activity_spike":
                round(file_spike, 3),

            "usb_activity_spike":
                round(usb_spike, 3),

            "external_email_spike":
                round(ext_spike, 3),

            "log_count":
                int(len(g)),
        })

    return pd.DataFrame(rows)


# ------------------------- Model Training + Scoring -------------------------
def run_analysis(logs, ground_truth=None):
    """
    Full pipeline: features -> scale -> Isolation Forest + LOF -> risk scores +
    explanations. Returns (employee_results, model_evaluation, feature_frame_records).
    ground_truth: optional dict employee_id -> 0/1 insider label for honest evaluation.
    """
    feats = engineer_features(logs)
    if feats.empty or len(feats) < 3:
        return [], {}, []

    X = feats[FEATURE_COLUMNS].fillna(0).values
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    # ---- Isolation Forest ----
    iso = IsolationForest(n_estimators=200, contamination=0.10, random_state=42)
    iso.fit(Xs)
    iso_scores = -iso.score_samples(Xs)  # higher = more anomalous
    iso_pred = (iso.predict(Xs) == -1).astype(int)

    # ---- Local Outlier Factor ----
    n_neighbors = min(20, max(2, len(feats) - 1))
    lof = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=0.02)
    lof_pred = (lof.fit_predict(Xs) == -1).astype(int)
    lof_scores = -lof.negative_outlier_factor_

    # Normalise anomaly scores to 0..1
    def norm(a):
        a = np.asarray(a, dtype=float)
        rng = a.max() - a.min()
        return (a - a.min()) / rng if rng > 1e-9 else np.zeros_like(a)

    iso_n = norm(iso_scores)
    lof_n = norm(lof_scores)
    anomaly = 0.6 * iso_n + 0.4 * lof_n  # ensemble

    # ---- Rule-based severity signal (weighted feature contributions) ----
    rule = _rule_score(feats)

    # Final risk score 0..100 (blend anomaly + rule signals, softly stretched)
    combined = 0.50 * anomaly + 0.50 * rule
    combined = np.power(combined, 0.85)  # gentle stretch to spread the mid-band
    risk_scores = np.clip(np.round(combined * 108), 0, 100).astype(int)

    results = []
    for i, (_, row) in enumerate(feats.iterrows()):
        score = int(risk_scores[i])
        reasons, evidence = _explain(row)
        results.append({
            "employee_id": row["employee_id"],
            "department": row["department"],
            "risk_score": score,
            "risk_level": risk_level(score),
            "anomaly_score": round(float(anomaly[i]), 4),
            "iso_flag": int(iso_pred[i]),
            "lof_flag": int(lof_pred[i]),
            "features": {k: _clean(row[k]) for k in FEATURE_COLUMNS},
            "reasons": reasons,
            "evidence": evidence,
            "recommended_actions": _recommend(score, reasons),
        })

    # ---- Model Evaluation ----
    # Use provided ground-truth insider labels when available (honest metrics);
    # otherwise fall back to ensemble consensus.
    if ground_truth:
        y_true = np.array([int(ground_truth.get(eid, 0)) for eid in feats["employee_id"]])
        if y_true.sum() == 0 or y_true.sum() == len(y_true):
            y_true = ((iso_pred + lof_pred) >= 1).astype(int)
    else:
        y_true = ((iso_pred + lof_pred) >= 1).astype(int)
    evaluation = _evaluate_models(Xs, y_true, iso_pred, lof_pred, iso_n, feats)

    return results, evaluation, feats.to_dict("records")


def _rule_score(feats):
    """
    CaughtIn4K V2 behavioural risk signal.

    Uses organisation-relative normalisation rather than
    hard-coding specific employee IDs or CERT labels.
    """

    def mm(col):
        values = feats[col].astype(float).values

        rng = values.max() - values.min()

        if rng <= 1e-9:
            return np.zeros_like(values)

        return (
            values - values.min()
        ) / rng


    weights = {
        # Traditional security behaviour
        "max_downloads": 0.05,
        "offhours_logins": 0.04,
        "restricted_access_count": 0.03,
        "total_failed_logins": 0.03,
        "external_email_ratio": 0.04,
        "max_external_emails": 0.03,

        # USB behaviour
        "usb_usage_count": 0.05,
        "max_usb_per_day": 0.07,
        "usb_file_overlap_days": 0.10,
        "usb_file_overlap_ratio": 0.08,

        # Job-search behaviour
        "max_daily_job_visits": 0.08,
        "job_activity_spike": 0.08,
        "job_web_ratio": 0.09,
        "offhours_job_visits": 0.05,

        # Cloud/web behaviour
        "cloud_storage_visits": 0.03,
        "max_daily_cloud_visits": 0.03,
        "offhours_web_requests": 0.03,
        "weekend_web_requests": 0.04,

        # Behaviour-change features
        "file_activity_spike": 0.04,
        "usb_activity_spike": 0.04,
        "external_email_spike": 0.04,
    }


    total = np.zeros(
        len(feats)
    )

    total_weight = sum(
        weights.values()
    )

    for column, weight in weights.items():

        total += (
            weight
            * mm(column)
        )


    if total_weight > 0:
        total = total / total_weight


    return np.clip(
        total,
        0,
        1
    )


def _clean(v):
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return round(float(v), 3)
    return v


def risk_level(score):
    if score >= 81:
        return "Critical"
    if score >= 61:
        return "High"
    if score >= 31:
        return "Medium"
    return "Low"


def _explain(row):
    """
    Human-readable explanations for CaughtIn4K V2.
    """

    reasons = []
    evidence = []


    # -------------------------------------------------
    # Authentication / session behaviour
    # -------------------------------------------------

    if row["offhours_logins"] >= 2:

        reasons.append(
            f"Logged in outside working hours "
            f"{int(row['offhours_logins'])} times"
        )

        evidence.append({
            "type": "login",
            "detail":
                f"{int(row['offhours_logins'])} "
                "off-hours sessions detected"
        })


    if row["weekend_logins"] >= 1:

        reasons.append(
            f"Accessed systems on weekends "
            f"{int(row['weekend_logins'])} times"
        )


    if row["avg_session_hours"] >= 11:

        reasons.append(
            f"Unusually long sessions averaging "
            f"{row['avg_session_hours']}h"
        )


    # -------------------------------------------------
    # File behaviour
    # -------------------------------------------------

    if row["max_downloads"] >= 20:

        reasons.append(
            f"Elevated file activity with a peak of "
            f"{int(row['max_downloads'])} events in one day"
        )


    if row["file_activity_spike"] >= 5:

        reasons.append(
            f"File activity spiked to "
            f"{row['file_activity_spike']:.1f}× "
            "the employee's normal daily level"
        )


    # -------------------------------------------------
    # USB behaviour
    # -------------------------------------------------

    if row["usb_usage_count"] >= 5:

        reasons.append(
            f"USB storage devices were connected "
            f"{int(row['usb_usage_count'])} times"
        )

        evidence.append({
            "type": "usb",
            "detail":
                f"{int(row['usb_usage_count'])} "
                "USB connection events"
        })


    if row["max_usb_per_day"] >= 3:

        reasons.append(
            f"Peak USB usage reached "
            f"{int(row['max_usb_per_day'])} "
            "connections in a single day"
        )


    if row["usb_file_overlap_days"] >= 4:

        reasons.append(
            f"USB usage and file activity occurred together "
            f"on {int(row['usb_file_overlap_days'])} days"
        )

        evidence.append({
            "type": "usb",
            "detail":
                f"{int(row['usb_file_overlap_days'])} "
                "USB/file correlation days"
        })


    if (
        row["usb_file_overlap_ratio"] >= 0.60
        and row["usb_active_days"] >= 3
    ):

        reasons.append(
            f"{int(row['usb_file_overlap_ratio'] * 100)}% "
            "of USB-active days also contained file activity"
        )


    if row["usb_activity_spike"] >= 5:

        reasons.append(
            f"USB activity showed a "
            f"{row['usb_activity_spike']:.1f}× behavioural spike"
        )


    # -------------------------------------------------
    # Web / job-search behaviour
    # -------------------------------------------------

    if row["max_daily_job_visits"] >= 8:

        reasons.append(
            f"Job-site browsing peaked at "
            f"{int(row['max_daily_job_visits'])} "
            "requests in one day"
        )


    if row["job_activity_spike"] >= 5:

        reasons.append(
            f"Job-site activity spiked to "
            f"{row['job_activity_spike']:.1f}× "
            "the employee's normal level"
        )


    if row["job_web_ratio"] >= 0.15:

        reasons.append(
            f"Job-search sites represented "
            f"{int(row['job_web_ratio'] * 100)}% "
            "of recorded web activity"
        )


    if row["offhours_job_visits"] >= 5:

        reasons.append(
            f"Visited job-search sites outside working hours "
            f"{int(row['offhours_job_visits'])} times"
        )


    if row["weekend_web_requests"] >= 50:

        reasons.append(
            f"High weekend web activity: "
            f"{int(row['weekend_web_requests'])} requests"
        )


    if row["offhours_web_requests"] >= 1000:

        reasons.append(
            f"High off-hours web activity: "
            f"{int(row['offhours_web_requests'])} requests"
        )


    # -------------------------------------------------
    # Cloud / email behaviour
    # -------------------------------------------------

    if row["cloud_storage_visits"] >= 100:

        reasons.append(
            f"Cloud-storage services were accessed "
            f"{int(row['cloud_storage_visits'])} times"
        )


    if row["external_email_ratio"] >= 0.4:

        reasons.append(
            f"High external email ratio "
            f"({int(row['external_email_ratio'] * 100)}%)"
        )


    if row["external_email_spike"] >= 5:

        reasons.append(
            f"External email activity showed a "
            f"{row['external_email_spike']:.1f}× spike"
        )


    # -------------------------------------------------
    # Existing enterprise indicators
    # -------------------------------------------------

    if row["restricted_access_count"] >= 1:

        reasons.append(
            f"Accessed restricted resources "
            f"{int(row['restricted_access_count'])} times"
        )


    if row["total_failed_logins"] >= 5:

        reasons.append(
            f"{int(row['total_failed_logins'])} "
            "failed login attempts were recorded"
        )


    if not reasons:

        reasons.append(
            "Behaviour is consistent with the "
            "organisation's historical baseline"
        )

    else:

        reasons.append(
            "Risk increased because multiple behavioural "
            "signals differ from expected activity"
        )


    return reasons, evidence


def _recommend(score, reasons):
    if score >= 81:
        return [
            "Immediately suspend account access pending review",
            "Escalate to CISO and open a formal investigation",
            "Preserve endpoint and network logs as evidence",
            "Interview the employee and their line manager",
        ]
    if score >= 61:
        return [
            "Assign a security analyst to investigate",
            "Enable enhanced monitoring on the account",
            "Review recent file transfers and USB activity",
        ]
    if score >= 31:
        return [
            "Add to watchlist for continued monitoring",
            "Verify recent activity with the employee's manager",
        ]
    return ["No action required; continue routine monitoring"]


def _evaluate_models(Xs, y_true, iso_pred, lof_pred, iso_scores, feats):
    """Compute classification metrics for each model vs consensus proxy."""
    models = {}

    def metrics_for(pred, scores, name):
        try:
            cm = confusion_matrix(y_true, pred, labels=[0, 1]).tolist()
            fpr, tpr, _ = roc_curve(y_true, scores)
            roc_auc = float(auc(fpr, tpr)) if len(set(y_true)) > 1 else 0.5
            tn = cm[0][0]; fp = cm[0][1]
            fp_rate = fp / (fp + tn) if (fp + tn) > 0 else 0.0
            return {
                "name": name,
                "accuracy": round(float(accuracy_score(y_true, pred)), 3),
                "precision": round(float(precision_score(y_true, pred, zero_division=0)), 3),
                "recall": round(float(recall_score(y_true, pred, zero_division=0)), 3),
                "f1": round(float(f1_score(y_true, pred, zero_division=0)), 3),
                "confusion_matrix": cm,
                "roc": [{"fpr": round(float(a), 3), "tpr": round(float(b), 3)} for a, b in zip(fpr, tpr)],
                "roc_auc": round(roc_auc, 3),
                "false_positive_rate": round(float(fp_rate), 3),
            }
        except Exception:
            return {"name": name, "accuracy": 0, "precision": 0, "recall": 0, "f1": 0,
                    "confusion_matrix": [[0, 0], [0, 0]], "roc": [], "roc_auc": 0.5,
                    "false_positive_rate": 0}

    iso_m = metrics_for(iso_pred, iso_scores, "Isolation Forest")
    lof_m = metrics_for(lof_pred, iso_scores, "Local Outlier Factor")
    models["models"] = [iso_m, lof_m]

    # Feature importance from Isolation Forest via variance of feature vs anomaly
    importances = []
    for i, col in enumerate(FEATURE_COLUMNS):
        corr = np.corrcoef(Xs[:, i], iso_scores)[0, 1]
        importances.append({"feature": FEATURE_LABELS[col], "importance": round(abs(float(corr)) if not np.isnan(corr) else 0.0, 3)})
    importances.sort(key=lambda x: x["importance"], reverse=True)
    models["feature_importance"] = importances

    # Best model by F1
    best = max(models["models"], key=lambda m: m["f1"])
    models["selected_model"] = best["name"]

    # Anomaly distribution
    scores = (feats["max_downloads"] * 0)  # placeholder not used
    models["anomaly_distribution"] = {
        "anomalies": int((y_true == 1).sum()),
        "normal": int((y_true == 0).sum()),
    }
    return models
