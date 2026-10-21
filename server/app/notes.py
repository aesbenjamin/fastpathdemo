NOTES = [
    {"code": 0, "name": "C4", "label": "Dó"},
    {"code": 1, "name": "D4", "label": "Ré"},
    {"code": 2, "name": "E4", "label": "Mi"},
    {"code": 3, "name": "F4", "label": "Fá"},
    {"code": 4, "name": "G4", "label": "Sol"},
    {"code": 5, "name": "A4", "label": "Lá"},
    {"code": 6, "name": "B4", "label": "Si"},
    {"code": 7, "name": "C5", "label": "Dó agudo"},
]

NUM_NOTES = len(NOTES)
NAME_TO_CODE = {n["name"]: n["code"] for n in NOTES}
CODE_TO_LABEL = {n["code"]: n["label"] for n in NOTES}
CODE_TO_NAME = {n["code"]: n["name"] for n in NOTES}
