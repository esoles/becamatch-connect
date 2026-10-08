CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  email text NOT NULL,
  birth_date date NOT NULL,
  study_level text NOT NULL,
  area text NOT NULL,
  countries text[] NOT NULL DEFAULT '{}',
  languages jsonb NOT NULL DEFAULT '[]',
  gpa numeric(4,2) NOT NULL CHECK (gpa >= 0 AND gpa <= 20),
  graduation_year int NOT NULL CHECK (graduation_year BETWEEN 1950 AND 2100),
  parental_status text NOT NULL DEFAULT 'no_requerida' CHECK (parental_status IN ('no_requerida','pendiente','aprobada','rechazada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Minors: parental status is set server-side from birth_date; users cannot self-approve.
CREATE OR REPLACE FUNCTION public.set_parental_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.birth_date > (current_date - interval '18 years') THEN
    IF TG_OP = 'INSERT' OR OLD.parental_status = 'no_requerida' THEN
      NEW.parental_status := 'pendiente';
    ELSE
      NEW.parental_status := OLD.parental_status;
    END IF;
  ELSE
    NEW.parental_status := 'no_requerida';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_parental BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_parental_status();

CREATE TABLE public.scholarships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity text NOT NULL,
  country text NOT NULL,
  study_level text,
  area text,
  language_code text,
  language_level text CHECK (language_level IN ('A1','A2','B1','B2','C1','C2')),
  min_gpa numeric(4,2) CHECK (min_gpa >= 0 AND min_gpa <= 20),
  deadline date NOT NULL,
  coverage text,
  requirements text,
  documents text,
  official_url text,
  verified boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  es_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scholarships TO anon, authenticated;
GRANT ALL ON public.scholarships TO service_role;
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read scholarships" ON public.scholarships FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.scholarships (name, entity, country, study_level, area, language_code, language_level, min_gpa, deadline, coverage, requirements, documents, official_url, verified, archived, es_demo) VALUES
('Beca Andina de Maestría en Ingeniería','Fundación Andina (demo)','Chile','Maestría','Ingeniería','es','B2',14,'2027-02-15','Matrícula completa y manutención mensual','Título universitario; promedio mínimo 14/20','CV, certificado de notas, carta de motivación','https://example.org/beca-andina',true,false,true),
('Programa Europa Ciencia de Datos','Consorcio Europeo (demo)','España','Maestría','Ciencias','en','B2',13,'2027-01-20','Matrícula y pasajes','Bachiller en carrera afín; inglés B2','CV, certificado de inglés, dos cartas de recomendación','https://example.org/europa-datos',true,false,true),
('Beca Excelencia Pregrado Lima','Universidad Demo','Perú','Pregrado',NULL,NULL,NULL,16,'2026-12-10','Media beca de pensión','Promedio mínimo 16/20 en secundaria','Certificado de estudios, DNI','https://example.org/excelencia-lima',true,false,true),
('Beca Canadá Salud Pública','Instituto Norte (demo)','Canadá','Maestría','Salud','en','C1',15,'2027-03-01','Beca completa','Experiencia de 1 año; inglés C1','CV, IELTS/TOEFL, ensayo','https://example.org/canada-salud',true,false,true),
('Intercambio Alemania Ingeniería','Red Técnica (demo)','Alemania','Pregrado','Ingeniería','de','A2',NULL,'2027-04-30','Manutención durante un semestre',NULL,'Carta de la universidad de origen',NULL,true,false,true),
('Beca México Ciencias Sociales','Colegio Demo','México','Doctorado','Ciencias Sociales','es','C1',17,'2027-05-15','Beca completa más seguro médico','Proyecto de investigación; promedio mínimo 17/20','Proyecto, CV, cartas','https://example.org/mexico-sociales',true,false,true),
('Beca Archivada (no debe aparecer)','Entidad Demo','Chile','Maestría','Ingeniería',NULL,NULL,NULL,'2027-06-01',NULL,NULL,NULL,NULL,true,true,true),
('Beca No Verificada (no debe aparecer)','Entidad Demo','España','Maestría','Ciencias',NULL,NULL,NULL,'2027-06-01',NULL,NULL,NULL,NULL,false,false,true),
('Beca Vencida (no debe aparecer)','Entidad Demo','Perú','Pregrado',NULL,NULL,NULL,NULL,'2026-01-01',NULL,NULL,NULL,NULL,true,false,true);