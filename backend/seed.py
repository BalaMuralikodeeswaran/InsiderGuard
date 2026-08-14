"""Generate a realistic simulated employee-activity dataset for InsiderGuard."""
import random
from datetime import datetime, timedelta, timezone

DEPARTMENTS = ["Finance", "Engineering", "HR", "Sales", "IT", "Legal", "Marketing", "Operations"]
LOCATIONS = ["HQ - New York", "Remote - Home", "Branch - London", "Branch - Singapore", "Remote - VPN"]
WEBSITE_CATS = ["Business", "Cloud Storage", "Social Media", "News", "Webmail", "File Sharing", "Development"]

FIRST = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth",
         "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Chris", "Karen",
         "Daniel", "Nancy", "Matthew", "Lisa", "Anthony", "Betty", "Mark", "Sandra", "Priya", "Wei",
         "Ahmed", "Sofia", "Carlos", "Yuki", "Ravi", "Ingrid", "Omar", "Chloe", "Diego", "Anya"]
LAST = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
        "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee",
        "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Patel", "Chen", "Kumar", "Nguyen",
        "Khan", "Singh", "Ali", "Kim", "Park", "Silva", "Costa", "Rossi", "Novak", "Petrov"]

AVATARS = [
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    "https://images.unsplash.com/photo-1699899657680-421c2c2d5064?w=100&h=100&fit=crop",
    "https://images.pexels.com/photos/29852895/pexels-photo-29852895.jpeg?w=100&h=100&fit=crop",
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop",
]


def _iso(dt):
    return dt.replace(microsecond=0).isoformat()


def generate_dataset(num_employees=48, days=30, insider_ratio=0.13, elevated_ratio=0.12, borderline_ratio=0.18):
    employees = []
    logs = []
    now = datetime.now(timezone.utc)
    num_insiders = max(3, int(num_employees * insider_ratio))
    num_elevated = max(3, int(num_employees * elevated_ratio))
    num_borderline = max(4, int(num_employees * borderline_ratio))
    pool = list(range(num_employees))
    random.shuffle(pool)
    insider_ids = set(pool[:num_insiders])
    elevated_ids = set(pool[num_insiders:num_insiders + num_elevated])
    borderline_ids = set(pool[num_insiders + num_elevated:num_insiders + num_elevated + num_borderline])

    for idx in range(num_employees):
        emp_id = f"EMP-{1000 + idx}"
        name = f"{random.choice(FIRST)} {random.choice(LAST)}"
        dept = random.choice(DEPARTMENTS)
        is_insider = idx in insider_ids
        is_elevated = idx in elevated_ids
        is_borderline = idx in borderline_ids
        base_ip = f"10.0.{random.randint(0,20)}."
        primary_device = f"WKS-{random.randint(100,999)}"
        last_login = None

        for d in range(days):
            day = now - timedelta(days=days - d)
            if day.weekday() >= 5 and not (is_insider and random.random() < 0.4):
                if random.random() < 0.85:
                    continue  # most people don't work weekends

            # normal working login
            if is_insider and random.random() < 0.5:
                login_hour = random.choice([1, 2, 3, 22, 23])  # off hours
            elif is_elevated and random.random() < 0.35:
                login_hour = random.choice([0, 5, 21, 22])
            elif is_borderline and random.random() < 0.2:
                login_hour = random.choice([6, 7, 20, 21])  # slightly off hours
            else:
                login_hour = random.randint(8, 10)
            login_dt = day.replace(hour=login_hour, minute=random.randint(0, 59), second=0)
            session_len = random.uniform(7, 9) if not is_insider else random.uniform(9, 14)
            logout_dt = login_dt + timedelta(hours=session_len)
            last_login = _iso(login_dt)

            if is_insider:
                downloads = random.randint(200, 1300)
                uploads = random.randint(20, 200)
                usb = 1 if random.random() < 0.5 else 0
                external = random.randint(15, 50)
                internal = random.randint(5, 25)
                failed = random.randint(0, 6)
                restricted = 1 if random.random() < 0.45 else 0
                device = primary_device if random.random() < 0.5 else f"LAP-{random.randint(100,999)}"
                ip = base_ip + str(random.randint(1, 250)) if random.random() < 0.5 else f"{random.randint(80,200)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
                website = random.choice(["Cloud Storage", "File Sharing", "Webmail", "Social Media"])
                vpn = 1 if random.random() < 0.6 else 0
            elif is_elevated:
                downloads = random.randint(120, 400)
                uploads = random.randint(15, 90)
                usb = 1 if random.random() < 0.3 else 0
                external = random.randint(10, 28)
                internal = random.randint(6, 22)
                failed = random.randint(0, 4)
                restricted = 1 if random.random() < 0.25 else 0
                device = primary_device if random.random() < 0.7 else f"LAP-{random.randint(100,999)}"
                ip = base_ip + str(random.randint(1, 250)) if random.random() < 0.75 else f"{random.randint(80,200)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
                website = random.choice(["Cloud Storage", "Webmail", "News", "Business"])
                vpn = 1 if random.random() < 0.45 else 0
            elif is_borderline:
                downloads = random.randint(60, 220)
                uploads = random.randint(10, 60)
                usb = 1 if random.random() < 0.18 else 0
                external = random.randint(5, 18)
                internal = random.randint(6, 25)
                failed = random.randint(0, 3)
                restricted = 1 if random.random() < 0.12 else 0
                device = primary_device if random.random() < 0.8 else f"LAP-{random.randint(100,999)}"
                ip = base_ip + str(random.randint(1, 250))
                website = random.choice(["Business", "Cloud Storage", "News", "Webmail"])
                vpn = 1 if random.random() < 0.35 else 0
            else:
                downloads = random.randint(2, 60)
                uploads = random.randint(0, 15)
                usb = 1 if random.random() < 0.05 else 0
                external = random.randint(0, 6)
                internal = random.randint(4, 30)
                failed = random.randint(0, 1)
                restricted = 1 if random.random() < 0.02 else 0
                device = primary_device
                ip = base_ip + str(random.randint(1, 250))
                website = random.choice(["Business", "News", "Development", "Business"])
                vpn = 1 if random.random() < 0.2 else 0

            logs.append({
                "employee_id": emp_id,
                "department": dept,
                "login_time": _iso(login_dt),
                "logout_time": _iso(logout_dt),
                "login_location": random.choice(LOCATIONS),
                "device": device,
                "ip_address": ip,
                "downloads": downloads,
                "uploads": uploads,
                "usb_connected": usb,
                "external_emails": external,
                "internal_emails": internal,
                "failed_logins": failed,
                "restricted_access": restricted,
                "website_category": website,
                "vpn_usage": vpn,
                "date": _iso(login_dt),
            })

        employees.append({
            "employee_id": emp_id,
            "name": name,
            "department": dept,
            "avatar": random.choice(AVATARS),
            "email": f"{name.lower().replace(' ', '.')}@insiderguard.io",
            "title": random.choice(["Analyst", "Manager", "Engineer", "Specialist", "Director", "Associate", "Lead"]),
            "join_date": _iso(now - timedelta(days=random.randint(200, 2000))),
            "status": "Active",
            "last_login": last_login,
            "_is_insider": is_insider,
        })

    return employees, logs


def build_csv_template():
    header = ("employee_id,department,login_time,logout_time,login_location,device,ip_address,"
              "downloads,uploads,usb_connected,external_emails,internal_emails,failed_logins,"
              "restricted_access,website_category,vpn_usage,date")
    sample = ("EMP-2001,Finance,2026-06-01T02:15:00,2026-06-01T11:40:00,Remote - VPN,LAP-231,"
              "88.120.34.9,1250,45,1,47,8,3,1,Cloud Storage,1,2026-06-01T02:15:00")
    return header + "\n" + sample + "\n"


def generate_monthly_incidents(months=6):
    """Historical SOC incident aggregates showing an escalating trend."""
    now = datetime.now(timezone.utc)
    MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    out = []
    base = 3
    for i in range(months - 1, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        step = (months - 1 - i)
        critical = base + step * 2 + random.randint(0, 2)
        high = base + step * 3 + random.randint(1, 4)
        medium = base + step * 4 + random.randint(2, 6)
        out.append({
            "month": f"{MONTHS[m - 1]} {str(y)[2:]}",
            "sort": y * 100 + m,
            "critical": critical,
            "high": high,
            "medium": medium,
            "total": critical + high + medium,
        })
    out.sort(key=lambda x: x["sort"])
    return out

