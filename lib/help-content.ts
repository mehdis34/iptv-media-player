import Ionicons from '@expo/vector-icons/Ionicons';

export type HelpSection = {
    id: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    items: string[];
};

export const helpSections: HelpSection[] = [
    {
        id: 'start',
        title: "Première connexion",
        icon: 'log-in-outline',
        items: [
            "Saisissez l’adresse exacte du serveur fournie par votre fournisseur (ex : https://exemple.com:8080).",
            "Entrez votre identifiant et votre mot de passe Xtream sans espaces, en respectant les majuscules.",
            "Choisissez un nom de profil et un avatar pour personnaliser l’accès.",
            "Validez : l’application charge le catalogue et vous arrivez sur l’accueil.",
        ],
    },
    {
        id: 'profiles',
        title: 'Profils',
        icon: 'people-outline',
        items: [
            "Créez plusieurs profils pour la famille ou différents usages (enfants, invités, etc.).",
            "Changez de profil depuis l’écran Mon compte pour retrouver les favoris et la reprise.",
            "Supprimez un profil via le mode “Gérer les profils” si vous n’en avez plus besoin.",
        ],
    },
    {
        id: 'home',
        title: "Accueil",
        icon: 'home-outline',
        items: [
            "Retrouvez les sections Films, Séries et TV en haut de l’écran pour naviguer rapidement.",
            "La grande carte met en avant un contenu recommandé ou à reprendre en un tap.",
            "Appuyez sur “Tout voir” pour ouvrir la section complète avec plus de choix.",
        ],
    },
    {
        id: 'movies-series',
        title: 'Films et séries',
        icon: 'film-outline',
        items: [
            "Utilisez le bouton “Catégories” pour filtrer par genre ou par thème.",
            "Touchez une affiche pour ouvrir la fiche détaillée (résumé, casting, bande‑annonce).",
            "Le bouton Lecture lance immédiatement la vidéo dans le lecteur.",
        ],
    },
    {
        id: 'tv',
        title: 'TV et guide',
        icon: 'tv-outline',
        items: [
            "L’onglet TV affiche les chaînes en direct prêtes à être lancées.",
            "Le guide TV montre la grille par chaîne pour voir ce qui passe maintenant ou plus tard.",
            "Le badge Live indique le programme en cours et sa progression.",
        ],
    },
    {
        id: 'search',
        title: 'Recherche',
        icon: 'search-outline',
        items: [
            "Utilisez la loupe pour trouver un film, une série ou une chaîne rapidement.",
            "Les résultats s’affichent dès les premières lettres saisies.",
            "Appuyez sur Lecture pour lancer directement le contenu.",
        ],
    },
    {
        id: 'favorites',
        title: 'Ma liste (favoris)',
        icon: 'heart-outline',
        items: [
            "Ajoutez un film, une série ou une chaîne à votre liste pour la retrouver plus tard.",
            "Retrouvez‑les dans l’onglet “Ma liste”, classés par type de contenu.",
            "Filtrez par Films, Séries ou Chaînes TV pour aller plus vite.",
        ],
    },
    {
        id: 'player',
        title: 'Lecteur vidéo',
        icon: 'play-circle-outline',
        items: [
            "Utilisez la télécommande pour afficher ou masquer les contrôles du lecteur.",
            "La barre de progression permet d’avancer ou de reculer facilement.",
            "Changez l’audio ou les sous‑titres depuis le menu dédié.",
            "Pour les séries, choisissez l’épisode dans le panneau Épisodes.",
            "En TV, le bouton Programme affiche la grille de la chaîne en cours.",
            "Le bouton Zap ouvre la liste des programmes pour passer à une autre chaîne.",
        ],
    },
    {
        id: 'resume',
        title: 'Reprendre la lecture',
        icon: 'refresh-outline',
        items: [
            "Les barres de progression indiquent clairement votre avancement sur chaque contenu.",
            "Le bouton “Reprendre” relance la vidéo exactement au bon moment.",
            "“Déjà vu” s’affiche quand un contenu est entièrement terminé.",
        ],
    },
    {
        id: 'tips',
        title: 'Astuces',
        icon: 'sparkles-outline',
        items: [
            "Si une chaîne ne démarre pas, vérifiez votre connexion et réessayez après quelques secondes.",
            "Le guide TV se met à jour via le bouton de rafraîchissement dans l’onglet TV.",
            "En cas de souci persistant, reconnectez‑vous ou contactez votre fournisseur.",
        ],
    },
];
