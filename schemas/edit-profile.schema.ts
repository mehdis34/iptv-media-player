import { z } from 'zod';

export const editProfileSchema = z.object({
  profileName: z.string().trim().min(1, 'Champ requis.'),
  avatarSeed: z.string().trim().min(1, 'Champ requis.'),
  host: z.string().trim().min(1, 'Champ requis.'),
  username: z.string().trim().min(1, 'Champ requis.'),
  password: z.string().trim().min(1, 'Champ requis.'),
});

export type EditProfileFormValues = z.infer<typeof editProfileSchema>;
