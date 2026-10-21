#!/usr/bin/env python3
"""
Логирование приёмов пищи.

Использование:
  log_meal.py add --member sergey --meal '{"time":"08:30","name":"Завтрак","items":[{"name":"Овсянка","grams":300,"kcal":297,"protein_g":11,"fat_g":6,"carbs_g":50}]}'
  log_meal.py list --member sergey --date 2026-09-04
  log_meal.py summary --member sergey --date 2026-09-04
"""

import sys
import json
import os
import argparse
import datetime

DATA_DIR = os.environ.get("HEALTH_DATA_DIR", "/opt/health/data")


def meals_file(member_id: str, date_str: str) -> str:
    meals_dir = os.path.join(DATA_DIR, member_id, "meals")
    os.makedirs(meals_dir, exist_ok=True)
    return os.path.join(meals_dir, f"{date_str}.json")


def load_meals(member_id: str, date_str: str) -> list:
    path = meals_file(member_id, date_str)
    if not os.path.exists(path):
        return []
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return []


def save_meals(member_id: str, date_str: str, meals: list):
    path = meals_file(member_id, date_str)
    with open(path, "w") as f:
        json.dump(meals, f, indent=2, ensure_ascii=False)


def cmd_add(member_id: str, meal_json: str, date_str: str):
    """Добавить приём пищи."""
    meal = json.loads(meal_json)
    # Убеждаемся что есть timestamp
    if "logged_at" not in meal:
        meal["logged_at"] = datetime.datetime.now().isoformat()
    if "date" not in meal:
        meal["date"] = date_str

    meals = load_meals(member_id, date_str)
    meals.append(meal)
    save_meals(member_id, date_str, meals)

    # Суммируем КБЖУ для подтверждения
    kcal = sum(i.get("kcal", 0) for i in meal.get("items", []))
    prot = sum(i.get("protein_g", 0) for i in meal.get("items", []))
    fat  = sum(i.get("fat_g", 0) for i in meal.get("items", []))
    carb = sum(i.get("carbs_g", 0) for i in meal.get("items", []))

    print(f"✅ Записано: {meal.get('name', 'Приём пищи')} | {kcal} ккал | Б{prot}г Ж{fat}г У{carb}г")
    print(f"   Файл: {meals_file(member_id, date_str)}")


def cmd_list(member_id: str, date_str: str):
    """Показать приёмы пищи за день."""
    meals = load_meals(member_id, date_str)
    if not meals:
        print(f"Нет записей за {date_str}")
        return

    total_kcal = total_prot = total_fat = total_carb = 0
    for m in meals:
        items = m.get("items", [])
        kcal = sum(i.get("kcal", 0) for i in items)
        prot = sum(i.get("protein_g", 0) for i in items)
        fat  = sum(i.get("fat_g", 0) for i in items)
        carb = sum(i.get("carbs_g", 0) for i in items)
        total_kcal += kcal; total_prot += prot
        total_fat  += fat;  total_carb += carb

        time_str = m.get("time", m.get("logged_at", "")[:5])
        item_names = ", ".join(i.get("name", "?") for i in items)
        print(f"  {time_str} {m.get('name','')}: {item_names} — {kcal} ккал")

    print(f"\nИтого за {date_str}: {total_kcal} ккал | Б{total_prot}г Ж{total_fat}г У{total_carb}г")


def cmd_summary(member_id: str, date_str: str) -> dict:
    """Сводка КБЖУ за день (для дашборда/дайджеста)."""
    meals = load_meals(member_id, date_str)
    total = {"kcal": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "meals_count": len(meals)}
    for m in meals:
        for i in m.get("items", []):
            total["kcal"]      += i.get("kcal", 0)
            total["protein_g"] += i.get("protein_g", 0)
            total["fat_g"]     += i.get("fat_g", 0)
            total["carbs_g"]   += i.get("carbs_g", 0)
    print(json.dumps(total, ensure_ascii=False))
    return total


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["add", "list", "summary"])
    parser.add_argument("--member", default="sergey")
    parser.add_argument("--date", default=datetime.date.today().isoformat())
    parser.add_argument("--meal", default="{}")
    args = parser.parse_args()

    if args.command == "add":
        cmd_add(args.member, args.meal, args.date)
    elif args.command == "list":
        cmd_list(args.member, args.date)
    elif args.command == "summary":
        cmd_summary(args.member, args.date)
