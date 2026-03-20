-- Rename ISLAMIQUE discipline to EDUCATION_ISLAMIQUE
UPDATE "disciplines"
SET "code" = 'EDUCATION_ISLAMIQUE',
    "name" = 'Education Islamique',
    "updated_at" = NOW()
WHERE "code" = 'ISLAMIQUE';

-- Insert new curriculum disciplines (idempotent)
INSERT INTO "disciplines" ("code", "name", "category", "sort_order", "created_at", "updated_at")
VALUES
    ('ALLEMAND', 'Allemand', 'SUBJECT', 16, NOW(), NOW()),
    ('ESPAGNOL', 'Espagnol', 'SUBJECT', 17, NOW(), NOW()),
    ('SNT', 'Sciences Numeriques et Technologie', 'SUBJECT', 18, NOW(), NOW()),
    ('ENS_SCIENTIFIQUE', 'Enseignement Scientifique', 'SUBJECT', 19, NOW(), NOW()),
    ('HGGSP', 'Histoire-Geo Geopolitique et Sciences Politiques', 'SUBJECT', 20, NOW(), NOW()),
    ('HLP', 'Humanites Litterature et Philosophie', 'SUBJECT', 21, NOW(), NOW()),
    ('LLCER', 'Langues Litteratures et Cultures Etrangeres', 'SUBJECT', 22, NOW(), NOW()),
    ('EMC', 'Enseignement Moral et Civique', 'SUBJECT', 23, NOW(), NOW()),
    ('MATHS_COMP', 'Mathematiques Complementaires', 'SUBJECT', 24, NOW(), NOW()),
    ('MATHS_EXPERTES', 'Mathematiques Expertes', 'SUBJECT', 25, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- Insert new discipline aliases (idempotent)
INSERT INTO "discipline_aliases" ("alias", "discipline_id", "created_at")
SELECT 'ATSEM', "id", NOW()
FROM "disciplines"
WHERE "code" = 'ASEM'
ON CONFLICT ("alias") DO NOTHING;

INSERT INTO "discipline_aliases" ("alias", "discipline_id", "created_at")
SELECT 'LVA Anglais', "id", NOW()
FROM "disciplines"
WHERE "code" = 'ANGLAIS_LV1'
ON CONFLICT ("alias") DO NOTHING;

INSERT INTO "discipline_aliases" ("alias", "discipline_id", "created_at")
SELECT 'Islamique', "id", NOW()
FROM "disciplines"
WHERE "code" = 'EDUCATION_ISLAMIQUE'
ON CONFLICT ("alias") DO NOTHING;
