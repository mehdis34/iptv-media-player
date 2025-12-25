import { z } from 'zod';

export const loginSchema = z.object({
  profileName: z
    .string()
    .trim()
    .min(2, 'Le nom de profil doit contenir au moins 2 caracteres.'),
  avatarSeed: z
    .string()
    .trim()
    .min(1, 'Veuillez choisir un avatar.'),
  host: z
    .string()
    .trim()
    .min(1, "L'hote est obligatoire."),
  username: z
    .string()
    .trim()
    .min(1, "L'identifiant est obligatoire."),
  password: z
    .string()
    .trim()
    .min(1, 'Le mot de passe est obligatoire.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
