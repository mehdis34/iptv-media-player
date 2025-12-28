import Ionicons from '@expo/vector-icons/Ionicons';
import {useRouter} from 'expo-router';
import {useMemo, useState} from 'react';
import {Modal, Pressable, ScrollView, Text, View} from 'react-native';

type HelpSection = {
    id: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    items: string[];
};

export default function HelpScreen() {
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<HelpSection | null>(null);

    const sections = useMemo<HelpSection[]>(
        () => [
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
                    "Tapez un titre complet ou une partie du titre pour trouver un film, une série ou une chaîne.",
                    "Les chaînes en cours et les suggestions s’affichent automatiquement si rien n’est saisi.",
                    "Appuyez sur Lecture pour lancer rapidement le contenu trouvé.",
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
                    "Touchez l’écran pour afficher ou masquer les contrôles du lecteur.",
                    "Utilisez la barre de progression pour avancer ou reculer facilement.",
                    "Changez l’audio ou les sous‑titres depuis le menu dédié.",
                    "Pour les séries, choisissez l’épisode dans le panneau Épisodes.",
                    "En TV, le bouton Programme affiche la grille de la chaîne en cours.",
                    "Le bouton Zap ouvre la liste des programmes pour passer rapidement à une autre chaîne.",
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
        ],
        []
    );

    return (
        <View className="flex-1 bg-ink">
            <View className="px-6 pt-16 pb-6">
                <View className="flex-row items-center gap-3">
                    <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
                        <Ionicons name="chevron-back" size={22} color="#ffffff"/>
                    </Pressable>
                    <Text className="font-display text-3xl text-white">Aide</Text>
                </View>
            </View>
            <ScrollView className="flex-1" contentContainerStyle={{paddingBottom: 80}}>
                <View className="px-6">
                    <View className="flex-row flex-wrap gap-4">
                        {sections.map((section) => (
                            <Pressable
                                key={section.id}
                                onPress={() => setActiveSection(section)}
                                className="w-[47%] rounded-3xl bg-ash px-4 py-5"
                            >
                                <View className="items-center">
                                    <View className="h-14 w-14 items-center justify-center rounded-2xl">
                                        <Ionicons name={section.icon} size={26} color="#ffffff"/>
                                    </View>
                                    <Text className="mt-3 text-center font-bodySemi text-sm text-white">
                                        {section.title}
                                    </Text>
                                </View>
                            </Pressable>
                        ))}
                    </View>
                </View>
            </ScrollView>
            <Modal
                transparent
                visible={!!activeSection}
                animationType="fade"
                onRequestClose={() => setActiveSection(null)}
            >
                <View className="flex-1 bg-black/70">
                    <Pressable className="flex-1" onPress={() => setActiveSection(null)} />
                    <View className="absolute bottom-0 left-0 right-0 rounded-t-[32px] bg-ash px-6 pb-16 pt-6">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-3">
                                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                                    <Ionicons
                                        name={activeSection?.icon ?? 'help-circle-outline'}
                                        size={20}
                                        color="#ffffff"
                                    />
                                </View>
                                <Text className="font-bodySemi text-xl text-white">
                                    {activeSection?.title}
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => setActiveSection(null)}
                                className="h-10 w-10 items-center justify-center"
                            >
                                <Ionicons name="close" size={22} color="#ffffff"/>
                            </Pressable>
                        </View>
                        <View className="mt-4 gap-3">
                            {activeSection?.items.map((item, index) => (
                                <View key={`${activeSection.id}-${index}`} className="flex-row items-center gap-3">
                                    <View className="h-2 w-2 rounded-full bg-ember"/>
                                    <Text className="flex-1 font-body text-base text-white/80">
                                        {item}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
