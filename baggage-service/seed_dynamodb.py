"""
seed_dynamodb.py — Seed the dams_baggage DynamoDB table
────────────────────────────────────────────────────────
Inserts the five original baggage records into DynamoDB.
Run once before using the baggage service for the first time,
or after wiping the table.

Usage:
    python seed_dynamodb.py

Credentials are read from environment variables (same as the service):
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN (if needed)
    AWS_DEFAULT_REGION  (defaults to eu-west-1)
    DYNAMODB_BAGGAGE_TABLE  (defaults to dams_baggage)
"""

import os
import boto3

TABLE_NAME = os.environ.get("DYNAMODB_BAGGAGE_TABLE", "dams_baggage")
REGION     = os.environ.get("AWS_DEFAULT_REGION", "eu-west-1")

RECORDS = [
    {"id": 1, "passenger_name": "Josh Perera",       "flight_id": 1, "status": "Checked In",  "location": "Heathrow Airport"},
    {"id": 2, "passenger_name": "Sarah Mendis",       "flight_id": 2, "status": "In Transit",  "location": "Dubai International Airport"},
    {"id": 3, "passenger_name": "Amal Fernando",      "flight_id": 1, "status": "Arrived",     "location": "Bandaranaike International Airport"},
    {"id": 4, "passenger_name": "Priya Jayawardena",  "flight_id": 3, "status": "Checked In",  "location": "Changi Airport"},
    {"id": 5, "passenger_name": "Nimal Wickrama",     "flight_id": 2, "status": "Lost",        "location": "Unknown"},
]


def main():
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table    = dynamodb.Table(TABLE_NAME)

    print(f"Seeding table '{TABLE_NAME}' in region '{REGION}' ...")

    for record in RECORDS:
        table.put_item(Item=record)
        print(f"  ✓  id={record['id']}  {record['passenger_name']}")

    print(f"\nDone — {len(RECORDS)} records inserted.")


if __name__ == "__main__":
    main()
