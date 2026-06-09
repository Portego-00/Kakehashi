/**
 * Pre-loaded anime MAL info — baked into the app bundle so the anime
 * selection screens render instantly without any network requests.
 *
 * To refresh:
 *   1. Clear the persistent cache (or delete the app).
 *   2. Open the anime selection screen and wait for all entries to load.
 *   3. Copy the JSON from the "[AnimeInfo] Full cache dump for preloading" console log.
 *   4. Replace the contents of PRELOADED_ANIME_INFO below.
 *
 * Any anime NOT present here will be fetched from MAL at runtime and
 * cached normally (so newly added ImmersionKit anime are handled automatically).
 */

import type { AnimeMALInfo } from "../services/animeInfoService";

// Paste the JSON dump from the console log inside this object:
export const PRELOADED_ANIME_INFO: Record<string, AnimeMALInfo> = {
  alya_sometimes_hides_her_feelings_in_russian: {
    malId: 54744,
    title: "Tokidoki Bosotto Russia-go de Dereru Tonari no Alya-san",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1596/152806.webp",
    synopsis:
      "Seirei Academy is a prestigious school attended by the very best students in Japan. Alisa Mikhailovna \"Alya\" Kujou, the half-Russian and half-Japanese treasurer of the school's student council, is known for her intelligence, stunning looks, and rigid personality. Contrasting her near-flawless persona, Alya's unmotivated classmate Masachika Kuze slacks off during lessons and seems to show no interest in her.\n\nInitially irritated, Alya gradually becomes more intrigued by Masachika and starts expressing her affection for him in Russian. However, she is oblivious to his secret—he understands the language fluently! Due to a childhood friend who was temporarily staying in Japan, Masachika has been studying Russian in hopes of reuniting with her.\n\nAs the two spend more time together, the playful and eccentric relationship between them quickly deepens. In the meantime, both must learn to navigate their new growing feelings for one another.\n\n[Written by MAL Rewrite]",
    score: 7.55,
    episodes: 12,
    mediaType: "tv",
  },
  angel_beats_: {
    malId: 6547,
    title: "Angel Beats!",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1244/111115.webp",
    synopsis:
      "Death is one of many mysteries that has left humanity in the dark since the dawn of time. However, the burning question of what happens to the soul after one dies is soon answered to 17-year-old Yuzuru Otonashi. Waking up with no previous memories in a dimension between life and death, he discovers the unsettling truth of the afterlife.  \n\nTaking the form of a high school, this bizarre dimension is designated to shelter those who died unwanted deaths. Feeling wronged by God during their earthly lives, the school's residents have decided to form the Afterlife Battlefront—a rebellious faction determined to oppose their god-like student council president, Kanade \"Angel\" Tachibana. The group's leader, Yuri Nakamura, recruits Otonashi in their fight against Angel in order to take control of their own lives. However, questioning the morality behind their actions, Otonashi takes a step behind the enemy lines to understand the opposing side of their common fate.\n\n[Written by MAL Rewrite]\n",
    score: 8.05,
    episodes: 13,
    mediaType: "tv",
  },
  assassination_classroom_season_1: {
    malId: 24833,
    title: "Ansatsu Kyoushitsu",
    imageUrl: "https://cdn.myanimelist.net/images/anime/5/75639.webp",
    synopsis:
      "Tucked in the mountains near the elite Kunugigaoka Middle School lies a small derelict building that houses the delinquents and dropouts of Class 3-E. Looked down upon by their peers, the students in this class appear to have little hope in advancing their academic careers. That is, until the national government tasks them with eliminating the greatest threat to their planet: their new teacher. \n\nHaving already destroyed the moon, the octopus-like professor—dubbed \"Koro-sensei\"—has now threatened to destroy the Earth by March of the following year. In light of their mission, the students have found that killing him is easier said than done. Not only can Koro-sensei move at speeds of up to Mach 20, but he can also resist almost every earthly weapon. Ironically, he also proves to be one of the best teachers Class 3-E has ever had. Training the class to excel in both their studies as students and skills as assassins, Koro-sensei is confident that his students' ingenuity and indomitable will could return them to the main campus. \n\nThrough trial and error, Nagisa Shiota, as well as the other students of Class 3-E, must figure out Koro-sensei's weaknesses—and fast, for the very fate of the world depends upon it.\n\n[Written by MAL Rewrite]\n",
    score: 8.07,
    episodes: 22,
    mediaType: "tv",
  },
  bakemonogatari: {
    malId: 5081,
    title: "Bakemonogatari",
    imageUrl: "https://cdn.myanimelist.net/images/anime/11/75274.webp",
    synopsis:
      "Koyomi Araragi, a third-year high school student, manages to survive a vampire attack with the help of Meme Oshino, a strange man residing in an abandoned building. Though being saved from vampirism and now a human again, several side effects such as superhuman healing abilities and enhanced vision still remain. Regardless, Araragi tries to live the life of a normal student, with the help of his friend and the class president, Tsubasa Hanekawa.\n\nWhen fellow classmate Hitagi Senjougahara falls down the stairs and is caught by Araragi, the boy realizes that the girl is unnaturally weightless. Despite Senjougahara's protests, Araragi insists he help her, deciding to enlist the aid of Oshino, the very man who had once helped him with his own predicament.\n\nThrough several tales involving demons and gods, Bakemonogatari follows Araragi as he attempts to help those who suffer from supernatural maladies.\n\n[Written by MAL Rewrite]",
    score: 8.32,
    episodes: 15,
    mediaType: "tv",
  },
  bunny_drop: {
    malId: 10162,
    title: "Usagi Drop",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1460/98853.webp",
    synopsis:
      "Daikichi Kawachi is a 30-year-old bachelor working a respectable job but otherwise wandering aimlessly through life. When his grandfather suddenly passes away, he returns to the family home to pay his respects. Upon arriving at the house, he meets a mysterious young girl named Rin who, to Daikichi’s astonishment, is his grandfather's illegitimate daughter!\n \nThe shy and unapproachable girl is deemed an embarrassment to the family, and finds herself ostracized by her father's relatives, all of them refusing to take care of her in the wake of his death. Daikichi, angered by their coldness toward Rin, announces that he will take her in—despite the fact that he is a young, single man with no prior childcare experience.\n\nUsagi Drop is the story of Daikichi's journey through fatherhood as he raises Rin with his gentle and affectionate nature, as well as an exploration of the warmth and interdependence that are at the heart of a happy, close-knit family.\n\n[Written by MAL Rewrite]",
    score: 8.32,
    episodes: 11,
    mediaType: "tv",
  },
  castle_in_the_sky: {
    malId: 513,
    title: "Tenkuu no Shiro Laputa",
    imageUrl: "https://cdn.myanimelist.net/images/anime/5/37799.jpg",
    synopsis:
      "In a world filled with planes and airships, Sheeta is a young girl who has been kidnapped by government agents who seek her mysterious crystal amulet. While trapped aboard an airship, she finds herself without hope—that is, until the ship is raided by pirates. Taking advantage of the ensuing confusion, Sheeta manages to flee from her captors. Upon her escape, she meets Pazu, a boy who dreams of reaching the fabled flying castle, Laputa. The two decide to embark on a journey together to discover this castle in the sky. However, they soon find the government agents back on their trail, as they too are trying to reach Laputa for their own greedy purposes.\n\nTenkuu no Shiro Laputa follows the soaring adventures of Sheeta and Pazu, all while they learn how dreams and dire circumstances can bring two people closer together.\n\n[Written by MAL Rewrite]",
    score: 8.26,
    episodes: 1,
    mediaType: "movie",
  },
  chobits: {
    malId: 59,
    title: "Chobits",
    imageUrl: "https://cdn.myanimelist.net/images/anime/4/24648.webp",
    synopsis:
      'When computers start to look like humans, can love remain the same?\n\nHideki Motosuwa is a young country boy who is studying hard to get into college. Coming from a poor background, he can barely afford the expenses, let alone the newest fad: Persocoms, personal computers that look exactly like human beings. One evening while walking home, he finds an abandoned Persocom. After taking her home and managing to activate her, she seems to be defective, as she can only say one word, "Chii," which eventually becomes her name. Unlike other Persocoms, however, Chii cannot download information onto her hard drive, so Hideki decides to teach her about the world the old-fashioned way, while studying for his college entrance exams at the same time.\n\nAlong with his friends, Hideki tries to unravel the mystery of Chii, who may be a "Chobit," an urban legend about special units that have real human emotions and thoughts, and love toward their owner. But can romance flourish between a Persocom and a human? \n\n[Written by MAL Rewrite]',
    score: 7.39,
    episodes: 26,
    mediaType: "tv",
  },
  clannad_after_story: {
    malId: 4181,
    title: "Clannad: After Story",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1299/110774.webp",
    synopsis:
      "Tomoya Okazaki and Nagisa Furukawa have graduated from high school, and together, they experience the emotional rollercoaster of growing up. Unable to decide on a course for his future, Tomoya learns the value of a strong work ethic and discovers the strength of Nagisa's support. Through the couple's dedication and unity of purpose, they push forward to confront their personal problems, deepen their old relationships, and create new bonds.\n\nTime also moves on in the Illusionary World. As the plains grow cold with the approach of winter, the Illusionary Girl and the Garbage Doll are presented with a difficult situation that reveals the World's true purpose.\n\n[Written by MAL Rewrite]",
    score: 8.93,
    episodes: 24,
    mediaType: "tv",
  },
  code_geass_season_1: {
    malId: 1575,
    title: "Code Geass: Hangyaku no Lelouch",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1032/135088.webp",
    synopsis:
      'In the year 2010, the Holy Empire of Britannia is establishing itself as a dominant military nation, starting with the conquest of Japan. Renamed to Area 11 after its swift defeat, Japan has seen significant resistance against these tyrants in an attempt to regain independence.\n\nLelouch Lamperouge, a Britannian student, unfortunately finds himself caught in a crossfire between the Britannian and the Area 11 rebel armed forces. He is able to escape, however, thanks to the timely appearance of a mysterious girl named C.C., who bestows upon him Geass, the "Power of Kings." Realizing the vast potential of his newfound "power of absolute obedience," Lelouch embarks upon a perilous journey as the masked vigilante known as Zero, leading a merciless onslaught against Britannia in order to get revenge once and for all.\n\n[Written by MAL Rewrite]',
    score: 8.71,
    episodes: 25,
    mediaType: "tv",
  },
  daily_lives_of_high_school_boys: {
    malId: 11843,
    title: "Danshi Koukousei no Nichijou",
    imageUrl: "https://cdn.myanimelist.net/images/anime/3/33257.webp",
    synopsis:
      "Roaming the halls of the all-boys Sanada North High School are three close comrades: the eccentric ringleader with a hyperactive imagination Hidenori, the passionate Yoshitake, and the rational and prudent Tadakuni. Their lives are filled with giant robots, true love, and intense drama... in their colorful imaginations, at least. In reality, they are just an everyday trio of ordinary guys trying to pass the time, but who said everyday life couldn't be interesting? Whether it's an intricate RPG reenactment or an unexpected romantic encounter on the riverbank at sunset, Danshi Koukousei no Nichijou is rife with bizarre yet hilariously relatable situations that are anything but mundane.\n\n[Written by MAL Rewrite]",
    score: 8.23,
    episodes: 12,
    mediaType: "tv",
  },
  demon_slayer___kimetsu_no_yaiba: {
    malId: 38000,
    title: "Kimetsu no Yaiba",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1286/99889.jpg",
    synopsis:
      "Ever since the death of his father, the burden of supporting the family has fallen upon Tanjirou Kamado's shoulders. Though living impoverished on a remote mountain, the Kamado family are able to enjoy a relatively peaceful and happy life. One day, Tanjirou decides to go down to the local village to make a little money selling charcoal. On his way back, night falls, forcing Tanjirou to take shelter in the house of a strange man, who warns him of the existence of flesh-eating demons that lurk in the woods at night.\n\nWhen he finally arrives back home the next day, he is met with a horrifying sight—his whole family has been slaughtered. Worse still, the sole survivor is his sister Nezuko, who has been turned into a bloodthirsty demon. Consumed by rage and hatred, Tanjirou swears to avenge his family and stay by his only remaining sibling. Alongside the mysterious group calling themselves the Demon Slayer Corps, Tanjirou will do whatever it takes to slay the demons and protect the remnants of his beloved sister's humanity.\n\n[Written by MAL Rewrite]",
    score: 8.41,
    episodes: 26,
    mediaType: "tv",
  },
  erased: {
    malId: 31043,
    title: "Boku dake ga Inai Machi",
    imageUrl: "https://cdn.myanimelist.net/images/anime/10/77957.webp",
    synopsis:
      'When tragedy is about to strike, Satoru Fujinuma finds himself sent back several minutes before the accident occurs. The detached, 29-year-old manga artist has taken advantage of this powerful yet mysterious phenomenon, which he calls "Revival," to save many lives.\n \nHowever, when he is wrongfully accused of murdering someone close to him, Satoru is sent back to the past once again, but this time to 1988, 18 years in the past. Soon, he realizes that the murder may be connected to the abduction and killing of one of his classmates, the solitary and mysterious Kayo Hinazuki, that took place when he was a child. This is his chance to make things right.\n \nBoku dake ga Inai Machi follows Satoru in his mission to uncover what truly transpired 18 years ago and prevent the death of his classmate while protecting those he cares about in the present.\n\n[Written by MAL Rewrite]',
    score: 8.3,
    episodes: 12,
    mediaType: "tv",
  },
  fate_stay_night_unlimited_blade_works: {
    malId: 22297,
    title: "Fate/stay night: Unlimited Blade Works",
    imageUrl: "https://cdn.myanimelist.net/images/anime/12/67333.jpg",
    synopsis:
      "The Holy Grail War is a battle royale among seven magi who serve as Masters. Masters, through the use of the command seals they are given when they enter the war, command Heroic Spirits known as Servants to fight for them in battle. In the Fifth Holy Grail War, Rin Toosaka is among the magi entering the competition. With her Servant, Archer, she hopes to obtain the ultimate prize—the Holy Grail, a magical artifact capable of granting its wielder any wish.\n \nOne of Rin's classmates, Shirou Emiya, accidentally enters the competition and ends up commanding a Servant of his own known as Saber. As they find themselves facing mutual enemies, Rin and Shirou decide to form a temporary alliance as they challenge their opponents in the Holy Grail War. \n\n[Written by MAL Rewrite]",
    score: 8.18,
    episodes: 12,
    mediaType: "tv",
  },
  fermat_kitchen: {
    malId: 60697,
    title: "Fermat no Ryouri",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1104/150590.jpg",
    synopsis:
      "Since childhood, Gaku Kitada has been fascinated with mathematics. As a student at the prestigious Wels Academy, he aimed to qualify for the Mathematics Olympiad and eventually secure admission to the University of Tokyo to become a great mathematician. His ambitious plans, however, do not come to fruition, as Gaku fails to qualify for the Olympiad's main event due to his anxiety and lack of self-confidence. This disastrous performance, coupled with his decision not to participate in future competitions, leads to his expulsion from the academy.\n\nDuring this crisis, Gaku meets Kai Asakura, an enigmatic professional chef who recognizes Gaku's peculiar way of cooking that incorporates math to create perfectly synergistic dishes. Despite his initial reservations, Gaku begins to utilize his mathematical perspective to cook, rekindling his love for the subject in the process. Wanting to understand this impulse more, Gaku decides to pivot his career trajectory to one that melds numbers with flavors to find solutions that can satisfy both his mind and the palate of his customers.\n\n[Written by MAL Rewrite]",
    score: 6.96,
    episodes: 12,
    mediaType: "tv",
  },
  frieren_beyond_journey_s_end: {
    malId: 52991,
    title: "Sousou no Frieren",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1015/138006.jpg",
    synopsis:
      "During their decade-long quest to defeat the Demon King, the members of the hero's party—Himmel himself, the priest Heiter, the dwarf warrior Eisen, and the elven mage Frieren—forge bonds through adventures and battles, creating unforgettable precious memories for most of them.\n\nHowever, the time that Frieren spends with her comrades is equivalent to merely a fraction of her life, which has lasted over a thousand years. When the party disbands after their victory, Frieren casually returns to her \"usual\" routine of collecting spells across the continent. Due to her different sense of time, she seemingly holds no strong feelings toward the experiences she went through.\n\nAs the years pass, Frieren gradually realizes how her days in the hero's party truly impacted her. Witnessing the deaths of two of her former companions, Frieren begins to regret having taken their presence for granted; she vows to better understand humans and create real personal connections. Although the story of that once memorable journey has long ended, a new tale is about to begin.\n\n[Written by MAL Rewrite]",
    score: 9.28,
    episodes: 28,
    mediaType: "tv",
  },
  from_the_new_world: {
    malId: 13125,
    title: "Shinsekai yori",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1549/136389.webp",
    synopsis:
      'In the year 2011, a small percentage of humans began manifesting psychokinetic abilities known as "Cantus." Over a millennium later, in the small town of Kamisu 66, Saki Watanabe is the last of her friends to awaken her powers and join the Sage Academy, a school for psychics like her. Although everyone at the institution has Cantus, they are not all equal; shortly after Saki enrolls, one of her classmates who is regarded as being weaker than the others suddenly disappears.\n\nWalking home one day with her friends—the determined Maria Akizuki, the intelligent Shun Aonuma, the observant Satoru Asahina, and the timid Mamoru Itou—she comes across two unfamiliar creatures known as "Monster Rats." These beings resemble moles and worship those with Cantus as gods. As a result, when Saki uses her abilities to save one from trouble, she is met with exceptional gratitude.\n\nNow unsure about the Monster Rats\' place in society, Saki and her friends find out about another disappearance. As time passes, they slowly look for answers to the mysteries that surround them and begin to realize that this seemingly "perfect" new world masks humanity\'s dark past.\n\n[Written by MAL Rewrite]',
    score: 8.24,
    episodes: 25,
    mediaType: "tv",
  },
  from_up_on_poppy_hill: {
    malId: 10029,
    title: "Coquelicot-zaka kara",
    imageUrl: "https://cdn.myanimelist.net/images/anime/8/32547.webp",
    synopsis:
      "Atop a hill overlooking a seaside port sits a boarding house named Coquelicot Manor. Since the building is run by her family, Umi Matsuzaki carries out many of the duties involved in managing the small establishment, such as preparing meals for her fellow boarders. When she isn't at home, she is a student at the local high school—one that is currently dealing with a small crisis.\n\nIn anticipation of the upcoming Olympic Games, a beloved old clubhouse is set to be demolished to make way for a modern building. As a result, a large part of the student body has banded together, working tirelessly to prevent this from happening. Umi finds herself helping the newspaper club to spread information about this cause where she befriends Shun Kazama, whom she gradually begins to fall in love with. But Shun is an orphan who doesn't know much about his origins, and when the two begin searching for clues to the boy's past, they discover that they may have a lot more in common than either of them could have thought.\n\n[Writtten by MAL Rewrite]",
    score: 7.78,
    episodes: 1,
    mediaType: "movie",
  },
  fruits_basket_season_1: {
    malId: 38680,
    title: "Fruits Basket 1st Season",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1447/99827.jpg",
    synopsis:
      'Tooru Honda has always been fascinated by the story of the Chinese zodiac that her beloved mother told her as a child. However, a sudden family tragedy changes her life, and subsequent circumstances leave her all alone. Tooru is now forced to live in a tent, but little does she know that her temporary home resides on the private property of the esteemed Souma family. Stumbling upon their home one day, she encounters Shigure, an older Souma cousin, and Yuki, the "prince" of her school. Tooru explains that she lives nearby, but the Soumas eventually discover her well-kept secret of being homeless when they see her walking back to her tent one night.\n\nThings start to look up for Tooru as they kindly offer to take her in after hearing about her situation. But soon after, she is caught up in a fight between Yuki and his hot-tempered cousin, Kyou. While trying to stop them, she learns that the Souma family has a well-kept secret of their own: whenever they are hugged by a member of the opposite sex, they transform into the animals of the Chinese zodiac.\n\nWith this new revelation, Tooru will find that living with the Soumas is an unexpected adventure filled with laughter and romance.\n\n[Written by MAL Rewrite]',
    score: 8.21,
    episodes: 25,
    mediaType: "tv",
  },
  fullmetal_alchemist_brotherhood: {
    malId: 5114,
    title: "Fullmetal Alchemist: Brotherhood",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1208/94745.jpg",
    synopsis:
      "After a horrific alchemy experiment goes wrong in the Elric household, brothers Edward and Alphonse are left in a catastrophic new reality. Ignoring the alchemical principle banning human transmutation, the boys attempted to bring their recently deceased mother back to life. Instead, they suffered brutal personal loss: Alphonse's body disintegrated while Edward lost a leg and then sacrificed an arm to keep Alphonse's soul in the physical realm by binding it to a hulking suit of armor.\n\nThe brothers are rescued by their neighbor Pinako Rockbell and her granddaughter Winry. Known as a bio-mechanical engineering prodigy, Winry creates prosthetic limbs for Edward by utilizing \"automail,\" a tough, versatile metal used in robots and combat armor. After years of training, the Elric brothers set off on a quest to restore their bodies by locating the Philosopher's Stone—a powerful gem that allows an alchemist to defy the traditional laws of Equivalent Exchange.\n\nAs Edward becomes an infamous alchemist and gains the nickname \"Fullmetal,\" the boys' journey embroils them in a growing conspiracy that threatens the fate of the world.\n\n[Written by MAL Rewrite]",
    score: 9.1,
    episodes: 64,
    mediaType: "tv",
  },
  god_s_blessing_on_this_wonderful_world_: {
    malId: 30831,
    title: "Kono Subarashii Sekai ni Shukufuku wo!",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1895/142748.jpg",
    synopsis:
      "After dying a laughable and pathetic death on his way back from buying a game, high school student and recluse Kazuma Satou finds himself sitting before a beautiful but obnoxious goddess named Aqua. She provides the NEET with two options: continue on to heaven or reincarnate in every gamer's dream—a real fantasy world! Choosing to start a new life, Kazuma is quickly tasked with defeating a Demon King who is terrorizing villages. But before he goes, he can choose one item of any kind to aid him in his quest, and the future hero selects Aqua. But Kazuma has made a grave mistake—Aqua is completely useless!\n\nUnfortunately, their troubles don't end here; it turns out that living in such a world is far different from how it plays out in a game. Instead of going on a thrilling adventure, the duo must first work to pay for their living expenses. Indeed, their misfortunes have only just begun!\n\n[Written by MAL Rewrite]",
    score: 8.09,
    episodes: 10,
    mediaType: "tv",
  },
  grave_of_the_fireflies: {
    malId: 578,
    title: "Hotaru no Haka",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1485/141208.jpg",
    synopsis:
      "As World War II reaches its conclusion in 1945, Japan faces widespread destruction in the form of American bombings, devastating city after city. Hotaru no Haka, also known as Grave of the Fireflies, is the story of Seita and his sister Setsuko, two Japanese children whose lives are ravaged by the brutal war. They have lost their mother, their father, their home, and the prospect of a bright future—all tragic consequences of the war.\n\nNow orphaned and homeless, Seita and Setsuko have no choice but to drift across the countryside, beset by starvation and disease. Met with the apathy of adults along the way, they find that desperate circumstances can turn even the kindest of people cruel yet their youthful hope shines brightly in the face of unrelenting hardship, preventing the siblings from swiftly succumbing to an inevitable fate.\n\n[Written by MAL Rewrite]",
    score: 8.54,
    episodes: 1,
    mediaType: "movie",
  },
  haruhi_suzumiya: {
    malId: 849,
    title: "Suzumiya Haruhi no Yuuutsu",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1470/137929.jpg",
    synopsis:
      'If a survey were conducted to see if people believed in aliens, time travelers, or maybe espers, most would say they do not; average high school student Kyon considers himself among the non-believers. However, on his first day of school, he meets a girl who soon turns his world upside down.\n\nDuring class introductions, the beautiful Haruhi Suzumiya boldly announces her boredom with "normal" people and her intention of meeting supernatural beings. Dumbfounded, Kyon learns of her frustration with the lack of paranormal-focused clubs at their school and unwittingly inspires her to start her own club. She creates the Spreading Fun all Over the World with Haruhi Suzumiya Brigade, otherwise known as the SOS Brigade.\n\nFollowing the SOS Brigade\'s founding, Haruhi manages to recruit Kyon and three other members: quiet bookworm Yuki Nagato, shy upperclassman Mikuru Asahina, and perpetually positive Itsuki Koizumi. Despite their normal appearance, the new members of the SOS Brigade each carry their own secrets related to Haruhi. Caught up in the mystery surrounding the eccentric club leader, Kyon is whisked away on a series of misadventures by Haruhi and the SOS Brigade, each one bringing him closer to the truth about who and what she is.\n\n[Written by MAL Rewrite]',
    score: 7.82,
    episodes: 14,
    mediaType: "tv",
  },
  howl_s_moving_castle: {
    malId: 431,
    title: "Howl no Ugoku Shiro",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1470/138723.jpg",
    synopsis:
      "That jumbled piece of architecture, that cacophony of hissing steam and creaking joints, with smoke billowing from it as it moves on its own... That castle is home to the magnificent wizard Howl, infamous for both his magical prowess and for being a womanizer—or so the rumor goes in Sophie Hatter's small town. Sophie, as the plain daughter of a hatmaker, does not expect much from her future and is content with working hard in the shop. \n\nHowever, Sophie's simple life takes a turn for the exciting when she is ensnared in a disturbing situation, and the mysterious wizard appears to rescue her. Unfortunately, this encounter, brief as it may be, spurs the vain and vengeful Witch of the Waste—in a fit of jealousy caused by a past discord with Howl—to put a curse on the maiden, turning her into an old woman.\n\nIn an endeavor to return to normal, Sophie must accompany Howl and a myriad of eccentric companions—ranging from a powerful fire demon to a hopping scarecrow—in his living castle, on a dangerous adventure as a raging war tears their kingdom apart.\n\n[Written by MAL Rewrite]",
    score: 8.67,
    episodes: 1,
    mediaType: "movie",
  },
  hyouka: {
    malId: 12189,
    title: "Hyouka",
    imageUrl: "https://cdn.myanimelist.net/images/anime/13/50521.webp",
    synopsis:
      "High school freshman Houtarou Oreki has but one goal: to lead a gray life while conserving as much energy as he can. Unfortunately, his peaceful days come to an end when his older sister, Tomoe, forces him to save the memberless Classics Club from disbandment.\n\nLuckily, Oreki's predicament seems to be over when he heads to the clubroom and discovers that his fellow first-year, Eru Chitanda, has already become a member. However, despite his obligation being fulfilled, Oreki finds himself entangled by Chitanda's curious and bubbly personality, soon joining the club of his own volition.\n\nSoon enough, the club's membership grows to four, as Oreki's friends Satoshi Fukube and Mayaka Ibara join. Driven by Chitanda's insatiable curiosity, the members of the Classics Club solve the trivial yet intriguing mysteries that permeate their daily lives.\n\n[Written by MAL Rewrite]",
    score: 8.05,
    episodes: 22,
    mediaType: "tv",
  },
  is_the_order_a_rabbit: {
    malId: 21273,
    title: "Gochuumon wa Usagi desu ka?",
    imageUrl: "https://cdn.myanimelist.net/images/anime/6/79600.jpg",
    synopsis:
      "Kokoa Hoto is a positive and energetic girl who becomes friends with anyone in just three seconds. After moving in with the Kafuu family in order to attend high school away from home, she immediately befriends the shy and precocious granddaughter of Rabbit House cafe's founder, Chino Kafuu, who is often seen with the talking rabbit, Tippy, on her head.\n\nAfter beginning to work as a waitress in return for room and board, Kokoa also befriends another part-timer, Rize Tedeza, who has unusual behavior and significant physical capabilities due to her military upbringing; Chiya Ujimatsu, a waitress from a rival cafe who does everything at her own pace; and Sharo Kirima, another waitress at a different cafe who has the air of a noblewoman despite being impoverished.\n\nWith fluffy silliness and caffeinated fun, Gochuumon wa Usagi Desu ka? is a heartwarming comedy about five young waitresses and their amusing adventures in the town they call home.\n\n[Written by MAL Rewrite]",
    score: 7.49,
    episodes: 12,
    mediaType: "tv",
  },
  k_on_: {
    malId: 5680,
    title: "K-On!",
    imageUrl: "https://cdn.myanimelist.net/images/anime/10/76120.webp",
    synopsis:
      "A fresh high school year always means much to come, and one of those things is joining a club. Being in a dilemma about which club to join, Yui Hirasawa stumbles upon and applies for the Light Music Club, which she misinterprets to be about playing simple instruments, such as castanets. Unable to play an instrument, she decides to visit to apologize and quit.\n\nMeanwhile, the Light Music Club faces disbandment due to a lack of members. This causes the club members to offer anything, from food to slacking off during club time, in order to convince Yui to join. Despite their efforts, Yui insists on leaving due to her lack of musical experience. As a last resort, they play a piece for Yui, which sparks her fiery passion and finally convinces her to join the club.\n\nFrom then onward, it is just plain messing around with bits and pieces of practice. The members of the Light Music Club are ready to make their time together a delightful one!\n\n[Written by MAL Rewrite]",
    score: 7.87,
    episodes: 13,
    mediaType: "tv",
  },
  kakegurui: {
    malId: 34933,
    title: "Kakegurui",
    imageUrl: "https://cdn.myanimelist.net/images/anime/3/86578.webp",
    synopsis:
      "Unlike many schools, attending Hyakkaou Private Academy prepares students for their time in the real world. Since many of the students are the children of the richest people in the world, the academy has its quirks that separate it from all the others. By day, it is a normal school, educating its pupils in history, languages, and the like. But at night, it turns into a gambling den, educating them in the art of dealing with money and manipulating people. Money is power; those who come out on top in the games stand at the top of the school.\n\nYumeko Jabami, a seemingly naive and beautiful transfer student, is ready to try her hand at Hyakkaou's special curriculum. Unlike the rest, she doesn't play to win, but for the thrill of the gamble, and her borderline insane way of gambling might just bring too many new cards to the table.\n\n[Written by MAL Rewrite]",
    score: 7.22,
    episodes: 12,
    mediaType: "tv",
  },
  kanon__2006_: {
    malId: 1530,
    title: "Kanon (2006)",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1362/128746.webp",
    synopsis:
      "As a young child, Aizawa Yuuichi had often visited his cousin in the city; however, something drastic happened to keep him away for seven long years. Now, Yuuichi returns, his memories of those days are simply gone.\n\nSettling into the wintry town, Yuuichi comes across several young girls, all of whom are connected to his past. As he befriends them and continues to interact with them, the long forgotten memories from his childhood begin to resurface...\n\n[Written by MAL Rewrite]",
    score: 7.94,
    episodes: 24,
    mediaType: "tv",
  },
  kiki_s_delivery_service: {
    malId: 512,
    title: "Majo no Takkyuubin",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1579/140483.webp",
    synopsis:
      "Kiki, a 13-year-old witch-in-training, must spend a year living on her own in a distant town in order to become a full-fledged witch. Leaving her family and friends, Kiki undertakes this tradition when she flies out into the open world atop her broomstick with her black cat Jiji.\n\nAs she settles down in the coastal town of Koriko, Kiki struggles to adapt and ends up wandering the streets with no place to stay—until she encounters Osono, who offers Kiki boarding in exchange for making deliveries for her small bakery. Before long, Kiki decides to open her own courier service by broomstick, beginning her journey to independence. In attempting to find her place among the townsfolk, Kiki brings with her exciting new experiences and comes to understand the true meaning of responsibility.\n\n[Written by MAL Rewrite]",
    score: 8.23,
    episodes: 1,
    mediaType: "movie",
  },
  kill_la_kill: {
    malId: 18679,
    title: "Kill la Kill",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1464/111943.jpg",
    synopsis:
      'After the murder of her father, Ryuuko Matoi has been wandering the land in search of his killer. Following her only lead—the missing half of his invention, the Scissor Blade—she arrives at the prestigious Honnouji Academy, a high school unlike any other. The academy is ruled by the imposing and cold-hearted student council president Satsuki Kiryuuin alongside her powerful underlings, the Elite Four. In the school\'s brutally competitive hierarchy, Satsuki bestows upon those at the top special clothes called "Goku Uniforms," which grant the wearer unique superhuman abilities. \n\nThoroughly beaten in a fight against one of the students in uniform, Ryuuko retreats to her razed home where she stumbles across Senketsu, a rare and sentient "Kamui," or God Clothes. After coming into contact with Ryuuko\'s blood, Senketsu awakens, latching onto her and providing her with immense power. Now, armed with Senketsu and the Scissor Blade, Ryuuko makes a stand against the Elite Four, hoping to reach Satsuki and uncover the culprit behind her father\'s murder once and for all. \n\n[Written by MAL Rewrite]',
    score: 8.03,
    episodes: 24,
    mediaType: "tv",
  },
  kino_s_journey: {
    malId: 486,
    title: "Kino no Tabi: The Beautiful World",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1763/95397.webp",
    synopsis:
      'Kino, a 15-year-old traveler, forms a bond with Hermes, a talking motorcycle. Together, they wander the lands and venture through various countries and places, despite having no clear idea of what to expect. After all, life is a journey filled with the unknown. \n\nThroughout their journeys, they encounter different kinds of customs, from the morally gray to tragic and fascinating. They also meet many people: some who live to work, some who live to make others happy, and some who live to chase their dreams. Thus, in every country they visit, there is always something to learn from the way people carry out their lives. \n\nIt is not up to Kino or Hermes to decide whether these asserted values are wrong or right, as they merely assume the roles of observers within this small world. They do not attempt to change or influence the places they visit, despite how absurd these values would appear. That\'s because in one way or another, they believe things are fine as they are, and that "the world is not beautiful; therefore, it is."\n\n[Written by MAL Rewrite]',
    score: 8.28,
    episodes: 13,
    mediaType: "tv",
  },
  kokoro_connect: {
    malId: 11887,
    title: "Kokoro Connect",
    imageUrl: "https://cdn.myanimelist.net/images/anime/2/39665.jpg",
    synopsis:
      'When five students at Yamaboshi Academy realize that there are no clubs where they fit in, they band together to form the Student Cultural Society, or "StuCS" for short. The club consists of: Taichi Yaegashi, a hardcore wrestling fan; Iori Nagase, an indecisive optimist; Himeko Inaba, a calm computer genius; Yui Kiriyama, a petite karate practitioner; and Yoshifumi Aoki, the class clown.\n \nOne day, Aoki and Yui experience a strange incident when, without warning, they switch bodies for a short period of time. As this supernatural phenomenon continues to occur randomly amongst the five friends, they begin to realize that it is not just fun and games. Now forced to become closer than ever, they soon discover each other\'s hidden secrets and emotional scars, which could end up tearing the StuCS and their friendship apart.\n\n[Written by MAL Rewrite]',
    score: 7.72,
    episodes: 13,
    mediaType: "tv",
  },
  little_witch_academia: {
    malId: 33489,
    title: "Little Witch Academia (TV)",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1520/147248.webp",
    synopsis:
      '"A believing heart is your magic!"—these were the words that Atsuko "Akko" Kagari\'s idol, the renowned witch Shiny Chariot, said to her during a magic performance years ago. Since then, Akko has lived by these words and aspired to be a witch just like Shiny Chariot, one that can make people smile. Hence, even her non-magical background does not stop her from enrolling in Luna Nova Magical Academy.\n\nHowever, when an excited Akko finally sets off to her new school, the trip there is anything but smooth. After her perilous journey, she befriends the shy Lotte Yansson and the sarcastic Sucy Manbavaran. To her utmost delight, she also discovers Chariot\'s wand, the Shiny Rod, which she takes as her own. Unfortunately, her time at Luna Nova will prove to be more challenging than Akko could ever believe. She absolutely refuses to stay inferior to the rest of her peers, especially to her self-proclaimed rival, the beautiful and gifted Diana Cavendish, so she relies on her determination to compensate for her reckless behavior and ineptitude in magic.\n\nIn a time when wizardry is on the decline, Little Witch Academia follows the magical escapades of Akko and her friends as they learn the true meaning of being a witch.\n\n[Written by MAL Rewrite]',
    score: 7.8,
    episodes: 25,
    mediaType: "tv",
  },
  lucky_star: {
    malId: 1887,
    title: "Lucky☆Star",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1561/115660.jpg",
    synopsis:
      "Lucky☆Star follows the daily lives of four cute high school girls—Konata Izumi, the lazy otaku; the Hiiragi twins, Tsukasa and Kagami (sugar and spice, respectively); and the smart and well-mannered Miyuki Takara.\n\nAs they go about their lives at school and beyond, they develop their eccentric and lively friendship and making humorous observations about the world around them. Be it Japanese tradition, the intricacies of otaku culture, academics, or the correct way of preparing and eating various foods—no subject is safe from their musings.\n\n[Written by MAL Rewrite]",
    score: 7.76,
    episodes: 24,
    mediaType: "tv",
  },
  my_little_sister_can_t_be_this_cute: {
    malId: 8769,
    title: "Ore no Imouto ga Konnani Kawaii Wake ga Nai",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1508/129576.webp",
    synopsis:
      "Kirino Kousaka embodies the ideal student with equally entrancing looks. Her grades are near perfect, and to cover her personal expenses, she works as a professional model alongside her best friend Ayase Aragaki, who abhors liars and all things otaku. But what Ayase doesn't know is that Kirino harbors a deep, entrenched secret that will soon be brought to light.\n\nAt home one day, Kyousuke, Kirino's perfectly average brother, stumbles upon an erotic game that belongs to none other than his seemingly flawless little sister. With her reputation at stake, Kirino places a gag order on her sibling while simultaneously introducing him to the world of eroge and anime. Through Kirino, Kyousuke encounters the gothic lolita Ruri Gokou and the bespectacled otaku Saori Makishima, thus jump-starting an entirely new lifestyle. But as he becomes more and more involved in his little sister's secret life, it becomes that much harder to keep under wraps. \n\n[Written by MAL Rewrite]",
    score: 6.92,
    episodes: 12,
    mediaType: "tv",
  },
  my_neighbor_totoro: {
    malId: 523,
    title: "Tonari no Totoro",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1110/147278.jpg",
    synopsis:
      'In 1950s Japan, Tatsuo Kusakabe relocates himself and his two daughters, Satsuki and Mei, to the countryside to be closer to their mother, who is hospitalized due to long-term illness. As the girls grow acquainted with rural life, Mei encounters a small, bunny-like creature in the yard one day. Chasing it into the forest, she finds "Totoro"—a giant, mystical forest spirit whom she soon befriends. Before long, Satsuki too meets Totoro, and the two girls suddenly find their lives filled with magical adventures in nature and fantastical creatures of the woods.\n\n[Written by MAL Rewrite]\n',
    score: 8.25,
    episodes: 1,
    mediaType: "movie",
  },
  new_game_: {
    malId: 31953,
    title: "New Game!",
    imageUrl: "https://cdn.myanimelist.net/images/anime/9/80417.webp",
    synopsis:
      "Since childhood, Aoba Suzukaze has loved the Fairies Story game series, particularly the character designs. So when she graduates from high school, it is no surprise that she applies to work at Eagle Jump, the company responsible for making her favorite video game. On her first day, she is excited to learn that she will be working on a new installment to the series: Fairies Story 3—and even more so under Kou Yagami, the lead character designer.\n\nIn their department are people who share the same passion for games. There is Yun Iijima, whose specialty is designing monsters; the shy Hifumi Takimoto, who prefers to communicate through instant messaging; Hajime Shinoda, an animation team member with an impressive figurine collection; Rin Tooyama, the orderly art director; Shizuku Hazuki, the game director who brings her cat to work; and Umiko Ahagon, the short-tempered head programmer.\n\nNew Game! follows Aoba and the others on their adventure through the ups and downs of game making, from making the perfect character design to fixing all the errors that will inevitably accumulate in the process.\n\n[Written by MAL Rewrite]",
    score: 7.55,
    episodes: 12,
    mediaType: "tv",
  },
  nisekoi: {
    malId: 18897,
    title: "Nisekoi",
    imageUrl: "https://cdn.myanimelist.net/images/anime/13/75587.webp",
    synopsis:
      "Raku Ichijou, a first-year student at Bonyari High School, is the sole heir to an intimidating yakuza family. Ten years ago, Raku made a promise to his childhood friend. Now, all he has to go on is a pendant with a lock, which can only be unlocked with the key which the girl took with her when they parted.\n\nNow, years later, Raku has grown into a typical teenager, and all he wants is to remain as uninvolved in his yakuza background as possible while spending his school days alongside his middle school crush Kosaki Onodera. However, when the American Bee Hive Gang invades his family's turf, Raku's idyllic romantic dreams are sent for a toss as he is dragged into a frustrating conflict: Raku is to pretend that he is in a romantic relationship with Chitoge Kirisaki, the beautiful daughter of the Bee Hive's chief, so as to reduce the friction between the two groups. Unfortunately, reality could not be farther from this whopping lie—Raku and Chitoge fall in hate at first sight, as the girl is convinced he is a pathetic pushover, and in Raku's eyes, Chitoge is about as attractive as a savage gorilla. \n\nNisekoi follows the daily antics of this mismatched couple who have been forced to get along for the sake of maintaining the city's peace. With many more girls popping up his life, all involved with Raku's past somehow, his search for the girl who holds his heart and his promise leads him in more unexpected directions than he expects.\n\n[Written by MAL Rewrite]",
    score: 7.55,
    episodes: 20,
    mediaType: "tv",
  },
  no_game_no_life: {
    malId: 19815,
    title: "No Game No Life",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1074/111944.webp",
    synopsis:
      "Sixteen sentient races inhabit Disboard, a world overseen by Tet, the One True God. The lowest of the sixteen—Imanity—consists of humans, a race with no affinity for magic. In a place where everything is decided through simple games, humankind seems to have no way out of their predicament—but the arrival of two outsiders poses a change.\n\nOn Earth, stepsiblings Sora and Shiro are two inseparable shut-ins who dominate various online games under the username \"Blank.\" While notorious on the internet, the pair believe that life is merely another dull game. However, after responding to a message from an unknown user, they are suddenly transported to Disboard. The mysterious sender turns out to be Tet, who informs them about the world's absolute rules. After Tet leaves, Sora and Shiro begin their search for more information and a place to stay, taking them to Elkia—Imanity's only remaining kingdom.\n\nThere, the duo encounters Stephanie Dola, an emotional girl vying for the kingdom's sovereignty. In desperation, she attempts to regain her father's throne, but her foolhardiness makes her goal unachievable. Inspired by the girl's motivation and passion, Sora and Shiro decide to aid Stephanie in getting Elkia back on its feet, ultimately aiming to become the new rulers of the enigmatic realm.\n\n[Written by MAL Rewrite]\n",
    score: 8.04,
    episodes: 12,
    mediaType: "tv",
  },
  noragami: {
    malId: 20507,
    title: "Noragami",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1886/128266.webp",
    synopsis:
      "In times of need, if you look in the right place, you just may see a strange telephone number scrawled in red. If you call this number, you will hear a young man introduce himself as the Yato God.\n\nYato is a minor deity and a self-proclaimed \"Delivery God,\" who dreams of having millions of worshippers. Without a single shrine dedicated to his name, however, his goals are far from being realized. He spends his days doing odd jobs for five yen apiece, until his weapon partner becomes fed up with her useless master and deserts him.\n\nJust as things seem to be looking grim for the god, his fortune changes when a middle school girl, Hiyori Iki, supposedly saves Yato from a car accident, taking the hit for him. Remarkably, she survives, but the event has caused her soul to become loose and hence able to leave her body. Hiyori demands that Yato return her to normal, but upon learning that he needs a new partner to do so, reluctantly agrees to help him find one. And with Hiyori's help, Yato's luck may finally be turning around.\n\n[Written by MAL Rewrite]",
    score: 7.94,
    episodes: 12,
    mediaType: "tv",
  },
  one_week_friends: {
    malId: 21327,
    title: "Isshuukan Friends.",
    imageUrl: "https://cdn.myanimelist.net/images/anime/6/61891.jpg",
    synopsis:
      'Sixteen-year-old Yuuki Hase finally finds the courage to speak to his crush and ask her if she wants to become friends. The object of his affection, Kaori Fujimiya, is a quiet and reserved girl who cuts herself off from everyone and does not spare him the same blunt rejection she gives everybody else.\n\nSome time after, Yuuki finds her eating lunch on the roof where she secludes herself during break. He decides to start meeting with Kaori every day in the hopes of beginning to understand her better. The more time they spend together, the more she begins to open up to him. However, nearing the end of the week, she starts to push him away once more. It is then revealed to him the reason for Kaori\'s cold front: at the end of the week, her memories of those close to her, excluding her family, are forgotten, as they are reset every Monday. The result of an accident in middle school, the once popular and kind Kaori is now unable to make friends in fear of hurting the people dear to her.\n\nDetermined to become more than just one week friends, Yuuki asks her the exact same question each Monday: "Would you like to be friends?" Because he knows that deep down, Kaori wishes for that more than anything.\n\n[Written by MAL Rewrite]',
    score: 7.52,
    episodes: 12,
    mediaType: "tv",
  },
  only_yesterday: {
    malId: 1029,
    title: "Omoide Poroporo",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1289/138708.webp",
    synopsis:
      "Taeko Okajima is a 27-year-old, independent woman who spent her entire life in Tokyo. Looking to unwind from the rush of the big city, she decides to visit her family in the country to help out during the harvest.\n\nOn the train there, Taeko vividly recalls her memories as a schoolgirl in the initial stages of puberty, as if she is on a trip with her childhood self. A young farmer named Toshio picks her up at the station, and they quickly develop a friendship. During her stay, Taeko forms strong bonds with family and friends, learning the contrasts between urban and rural life, as well as the struggles and joys of farming.\n\nNostalgic and bittersweet, Omoide Poroporo takes on Taeko's journey as an adult woman coming to terms with her childhood dreams compared to the person she is today.\n\n[Written by MAL Rewrite]",
    score: 7.44,
    episodes: 1,
    mediaType: "movie",
  },
  princess_mononoke: {
    malId: 164,
    title: "Mononoke Hime",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1355/147277.jpg",
    synopsis:
      "When an Emishi village is attacked by a fierce demon boar, the young prince Ashitaka puts his life at stake to defend his tribe. With its dying breath, the beast curses the prince's arm, granting him demonic powers while gradually siphoning his life away. Instructed by the village elders to travel westward for a cure, Ashitaka arrives at Tatara, the Iron Town, where he finds himself embroiled in a fierce conflict: Lady Eboshi of Tatara, promoting constant deforestation, stands against Princess San and the sacred spirits of the forest, who are furious at the destruction brought by the humans. As the opposing forces of nature and mankind begin to clash in a desperate struggle for survival, Ashitaka attempts to seek harmony between the two, all the while battling the latent demon inside of him. Princess Mononoke is a tale depicting the connection of technology and nature, while showing the path to harmony that could be achieved by mutual acceptance.\n\n[Written by MAL Rewrite]",
    score: 8.67,
    episodes: 1,
    mediaType: "movie",
  },
  shirokuma_cafe: {
    malId: 12815,
    title: "Shirokuma Cafe",
    imageUrl: "https://cdn.myanimelist.net/images/anime/6/75649.jpg",
    synopsis:
      "Situated near the local zoo and owned by the charismatic polar bear Shirokuma, Shirokuma Cafe is a popular spot for animals and humans alike, allowing them to sit back and relax after a hard day of work. Whether it's a cold beverage or the latest item on his menu, Shirokuma finds joy in being able to serve his customers, often striking up conversations about various subjects.\n\nTogether with the sarcastic Penguin and the clumsy Panda, they form an odd trio who get themselves caught up in all sorts of misadventures with their other friends such as Grizzly, a bar owner, and Sasako, a human who works at the cafe. From dealing with unrequited love, outdoor camping trips, karaoke sessions, and even the secret to brewing delicious coffee, there's always something bound to be happening in Shirokuma Cafe!\n\n[Written by MAL Rewrite]",
    score: 7.89,
    episodes: 50,
    mediaType: "tv",
  },
  sound__euphonium: {
    malId: 27989,
    title: "Hibike! Euphonium",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1517/142072.webp",
    synopsis:
      "Now that Kumiko Oumae has enrolled in Kitauji High School, she hopes to forget about her past. Despite her desire for a fresh start, she gets dragged into the school's band club by her new friends—Sapphire Kawashima and Hazuki Katou—and is once again stuck playing the euphonium. \n\nAs the band currently stands, they won't be able to participate in the local festival, Sunfest, let alone compete at a national level. The band's new advisor, Noboru Taki, gives them a choice: they can relax and have fun, or practice hard and attempt to get into nationals. Not wanting to repeat her mistakes from middle school, Kumiko is doubtful as to whether they should try for nationals. Amidst the chaos, she learns that her old bandmate, Reina Kousaka (who she had a bitter relationship with) has joined Kitauji's band club. Under the pressure of Noboru's strict training, Kumiko and her bandmates must learn to overcome their struggles and find success together.\n\n[Written by MAL Rewrite]\n",
    score: 8.02,
    episodes: 13,
    mediaType: "tv",
  },
  spirited_away: {
    malId: 199,
    title: "Sen to Chihiro no Kamikakushi",
    imageUrl: "https://cdn.myanimelist.net/images/anime/6/79597.webp",
    synopsis:
      "Stubborn, spoiled, and naïve, 10-year-old Chihiro Ogino is less than pleased when she and her parents discover an abandoned amusement park on the way to their new house. Cautiously venturing inside, she realizes that there is more to this place than meets the eye, as strange things begin to happen once dusk falls. Ghostly apparitions and food that turns her parents into pigs are just the start—Chihiro has unwittingly crossed over into the spirit world. Now trapped, she must summon the courage to live and work amongst spirits, with the help of the enigmatic Haku and the cast of unique characters she meets along the way.\n\nVivid and intriguing, Sen to Chihiro no Kamikakushi tells the story of Chihiro's journey through an unfamiliar world as she strives to save her parents and return home.\n\n[Written by MAL Rewrite]",
    score: 8.77,
    episodes: 1,
    mediaType: "movie",
  },
  the_cat_returns: {
    malId: 597,
    title: "Neko no Ongaeshi",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1109/138719.webp",
    synopsis:
      "High school student Haru Yoshioka is bored with the monotony of life. One day, she saves Prince Lune of the Cat Kingdom from being run over by a truck. As a token of gratitude, the Cat King sends her \"presents\" and invites her to the Cat Kingdom to become Lune's wife. Haru's inability to properly communicate with the cats leads to the misunderstanding that she has accepted the proposal.\n\nAs Haru ponders on ways to escape the predicament, a mysterious voice instructs her to search for the Cat Bureau. However, not long after she finally arrives at the bureau, a horde of cats swarms in and forcibly takes her to the Cat Kingdom, along with a member of the Cat Bureau. Concerned for their safety, owner of the Cat Bureau, Baron Humbert von Gikkingen, follows close behind.\n\nThe more Haru immerses herself in the activities of the Cat Kingdom, the more cat-like she becomes. To her dismay, she soon learns that, unless she can find her true self, she may become a cat permanently. Haru's adventures in the world of cats lead her down a path to self-discovery, allowing her to return as a more confident person.\n\n[Written by MAL Rewrite]",
    score: 7.71,
    episodes: 1,
    mediaType: "movie",
  },
  the_garden_of_words: {
    malId: 16782,
    title: "Kotonoha no Niwa",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1597/112995.webp",
    synopsis:
      "On a rainy morning in Tokyo, Takao Akizuki, an aspiring shoemaker, decides to skip class to sketch designs in a beautiful garden. This is where he meets Yukari Yukino, a beautiful yet mysterious woman, for the very first time. Offering to make her new shoes, Takao continues to meet with Yukari throughout the rainy season, and without even realizing it, the two are able to alleviate the worries hidden in their hearts just by being with each other. However, their personal struggles have not disappeared completely, and as the end of the rainy season approaches, their relationship will be put to the test.\n\n[Written by MAL Rewrite]",
    score: 7.85,
    episodes: 1,
    mediaType: "movie",
  },
  the_girl_who_leapt_through_time: {
    malId: 2236,
    title: "Toki wo Kakeru Shoujo",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1/2432.webp",
    synopsis:
      "Makoto Konno is in her last year of high school, but is having a hard time deciding what to do with her future. In between enduring the pressure of her teachers and killing time with her best friends, Makoto's life suddenly changes when she accidentally discovers that she is capable of literally leaping through time.\n\nToki wo Kakeru Shoujo follows Makoto as she plays around with her newfound power. However, she soon learns the hard way that every choice has a consequence, and time is a lot more complicated than it may seem.\n\n[Written by MAL Rewrite]",
    score: 8.09,
    episodes: 1,
    mediaType: "movie",
  },
  the_irregular_at_magic_high_school: {
    malId: 20785,
    title: "Mahouka Koukou no Rettousei",
    imageUrl: "https://cdn.myanimelist.net/images/anime/11/61039.jpg",
    synopsis:
      'In the dawn of the 21st century, magic, long thought to be folklore and fairy tales, has become a systematized technology and is taught as a technical skill. In First High School, the institution for magicians, students are segregated into two groups based on their entrance exam scores: "Blooms," those who receive high scores, are assigned to the First Course, while "Weeds" are reserve students assigned to the Second Course.\n\nMahouka Koukou no Rettousei follows the siblings, Tatsuya and Miyuki Shiba, who are enrolled in First High School. Upon taking the exam, the prodigious Miyuki is placed in the First Course, while Tatsuya is relegated to the Second Course. Though his practical test scores and status as a "Weed" show him to be magically inept, he possesses extraordinary technical knowledge, physical combat capabilities, and unique magic techniques—making Tatsuya the irregular at a magical high school.\n\n[Written by MAL Rewrite]',
    score: 7.36,
    episodes: 26,
    mediaType: "tv",
  },
  the_pet_girl_of_sakurasou: {
    malId: 13759,
    title: "Sakura-sou no Pet na Kanojo",
    imageUrl: "https://cdn.myanimelist.net/images/anime/4/43643.jpg",
    synopsis:
      "At Suimei High, the Sakura-sou dormitory is infamous for housing the school's most notorious delinquents. Thus, when the relatively tame Sorata Kanda is transferred to the dorm, escaping this insane asylum becomes his foremost goal. Trapped there for the time being, he must learn how to deal with his fellow residents, including bubbly animator Misaki Kamiigusa, charming playboy writer Jin Mitaka, and the ever-reclusive Ryuunosuke Akasaka. Surrounded by weirdness, Sorata frequently finds respite in his interactions with his one \"normal\" friend, aspiring voice actress Nanami Aoyama.\n\nWhen Mashiro Shiina—a new foreign exchange student—joins the dormitory, Sorata is instantly enraptured by her beauty. Underneath her otherworldly appearance, Mashiro is an autistic savant, capable of world-renowned brilliance in her art, yet unable to perform simple daily tasks. After Sorata ends up in charge of taking care of Mashiro, the two inevitably grow closer, with Sorata's initial desire to escape the dormitory becoming a forgotten goal.\n\nDespite their eccentricities, every resident is incredible in their own field, leaving Sorata to contend with his own lack of any particular skill. With brilliance all around him, he thus strives to become an equal to their talent. Revolving around the hardships and joys of its colorful cast, Sakura-sou no Pet na Kanojo is a heartwarming coming-of-age tale of friendship, love, ambition, and heartbreak—through the lens of an ordinary person surrounded by the extraordinary.\n\n[Written by MAL Rewrite]\n",
    score: 8.04,
    episodes: 24,
    mediaType: "tv",
  },
  the_secret_world_of_arrietty: {
    malId: 7711,
    title: "Karigurashi no Arrietty",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1974/116417.jpg",
    synopsis:
      "While spending the summer at his aunt's house, the young but sickly Shou makes an amazing discovery: after following the house cat into the bushes, he gets a glimpse of a miniature girl about the size of his finger! Calling her kind \"Borrowers,\" as they survive on tiny bits of human possessions, the girl introduces herself as Arrietty. As he discovers that she lives in the house basement with her parents, Pod and Homily, Shou becomes imaginably excited at the idea of such unique neighbors.\n\nHowever, he fails to understand the adversities they face on a daily basis. In addition to keeping their existence hidden, they must also embark on perilous adventures into human territory, from the house to the outdoors, in order to make a living. Despite her parents' warnings, Arrietty befriends Shou, stirring up unexpected events that may change their lives forever.\n\nDelighting the eye and conquering the heart, the breath-taking story of a friendship transcending the tensions between two different human kinds begins.\n\n[Written by MAL Rewrite]",
    score: 7.9,
    episodes: 1,
    mediaType: "movie",
  },
  the_wind_rises: {
    malId: 16662,
    title: "Kaze Tachinu",
    imageUrl: "https://cdn.myanimelist.net/images/anime/8/52353.jpg",
    synopsis:
      "Although Jirou Horikoshi's nearsightedness prevents him from ever becoming a pilot, he leaves his hometown to study aeronautical engineering at Tokyo Imperial University for one simple purpose: to design and build planes just like his hero, Italian aircraft pioneer Giovanni Battista Caproni. His arrival in the capital coincides with the Great Kanto Earthquake of 1923, during which he saves a maid serving the family of a young girl named Naoko Satomi; this disastrous event marks the beginning of over two decades of social unrest and malaise leading up to Japan's eventual surrender in World War II.\n\nFor Jirou, the years leading up to the production of his infamous Mitsubishi A6M Zero fighter aircraft will test every fiber of his being. His many travels and life experiences only urge him onward⁠—even as he realizes both the role of his creations in the war and the harsh realities of his personal life. As time marches on, he must confront an impossible question: at what cost does he chase his beautiful dream?\n\n[Written by MAL Rewrite]\n",
    score: 8.13,
    episodes: 1,
    mediaType: "movie",
  },
  the_world_god_only_knows: {
    malId: 8525,
    title: "Kami nomi zo Shiru Sekai",
    imageUrl: "https://cdn.myanimelist.net/images/anime/2/43361.webp",
    synopsis:
      'Keima Katsuragi, known online as the legendary "God of Conquest," can conquer any girl\'s heart—in dating sim games, at least. In reality, he opts for the two-dimensional world of gaming over real life because he is an unhealthily obsessed otaku of galge games (a type of Japanese video game centered on interactions with attractive girls).\n\nWhen he arrogantly accepts an anonymous offer to prove his supremacy at dating sim games, Keima is misled into aiding a naive and impish demon from hell named Elucia "Elsie" de Lute Ima with her mission: retrieving runaway evil spirits who have escaped from hell and scattered themselves throughout the human world. Keima discovers that the only way to capture these spirits is to conquer what he hates the most: the unpredictable hearts of three-dimensional girls! Shackled to Elsie via a deadly collar, Keima now has his title of "God of Conquest" put to the ultimate test as he is forced to navigate through the hearts of a multitude of real-life girls.\n\n[Written by MAL Rewrite]',
    score: 7.64,
    episodes: 12,
    mediaType: "tv",
  },
  toradora_: {
    malId: 4224,
    title: "Toradora!",
    imageUrl: "https://cdn.myanimelist.net/images/anime/13/22128.jpg",
    synopsis:
      'Ryuuji Takasu is a gentle high school student with a love for housework; but in contrast to his kind nature, he has an intimidating face that often gets him labeled as a delinquent. On the other hand is Taiga Aisaka, a small, doll-like student, who is anything but a cute and fragile girl. Equipped with a wooden katana and feisty personality, Taiga is known throughout the school as the "Palmtop Tiger."\n\nOne day, an embarrassing mistake causes the two students to cross paths. Ryuuji discovers that Taiga actually has a sweet side: she has a crush on the popular vice president, Yuusaku Kitamura, who happens to be his best friend. But things only get crazier when Ryuuji reveals that he has a crush on Minori Kushieda—Taiga\'s best friend!\n\nToradora! is a romantic comedy that follows this odd duo as they embark on a quest to help each other with their respective crushes, forming an unlikely alliance in the process.\n\n[Written by MAL Rewrite]',
    score: 8.04,
    episodes: 25,
    mediaType: "tv",
  },
  wandering_witch_the_journey_of_elaina: {
    malId: 40571,
    title: "Majo no Tabitabi",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1802/108501.webp",
    synopsis:
      "Since childhood, Elaina has always been fascinated by the stories written within her favorite book, especially those about Nike, a renowned witch who had numerous great travels across the world. Wanting to experience the awe of adventure herself, Elaina strives to become a witch, and despite the numerous trials that come her way, she eventually succeeds.\n\nNow a full-fledged witch, Elaina finally embarks on her long-awaited journey, in which she meets many people along the way, learning their various stories. Through all of this, she explores the world at its fullest—experiencing both its bright and dark sides—starting her legendary tale.\n\n[Written by MAL Rewrite]",
    score: 7.56,
    episodes: 12,
    mediaType: "tv",
  },
  weathering_with_you: {
    malId: 38826,
    title: "Tenki no Ko",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1880/101146.webp",
    synopsis:
      'Tokyo is currently experiencing rain showers that seem to disrupt the usual pace of everyone living there to no end. Amidst this seemingly eternal downpour arrives the runaway high school student Hodaka Morishima, who struggles to financially support himself—ending up with a job at a small-time publisher. At the same time, the orphaned Hina Amano also strives to find work to sustain herself and her younger brother.\n\nBoth fates intertwine when Hodaka attempts to rescue Hina from shady men, deciding to run away together. Subsequently, Hodaka discovers that Hina has a strange yet astounding power: the ability to call out the sun whenever she prays for it. With Tokyo\'s unusual weather in mind, Hodaka sees the potential of this ability. He suggests that Hina should become a "sunshine girl"—someone who will clear the sky for people when they need it the most.\n\nThings begin looking up for them at first. However, it is common knowledge that power always comes with a hefty price...\n\n[Written by MAL Rewrite]',
    score: 8.27,
    episodes: 1,
    mediaType: "movie",
  },
  when_marnie_was_there: {
    malId: 21557,
    title: "Omoide no Marnie",
    imageUrl: "https://cdn.myanimelist.net/images/anime/7/64293.webp",
    synopsis:
      "Suffering from frequent asthma attacks, young Anna Sasaki is quiet, unsociable, and isolated from her peers, causing her foster parent endless worry. Upon recommendation by the doctor, Anna is sent to the countryside, in hope that the cleaner air and more relaxing lifestyle will improve her health and help clear her mind. Engaging in her passion for sketching, Anna spends her summer days living with her aunt and uncle in a small town near the sea.\n\nOne day while wandering outside, Anna discovers an abandoned mansion known as the Marsh House. However, she soon finds that the residence isn't as vacant as it appears to be, running into a mysterious girl named Marnie. Marnie's bubbly demeanor slowly begins to draw Anna out of her shell as she returns night after night to meet with her new friend. But it seems there is more to the strange girl than meets the eye—as her time in the town nears its end, Anna begins to discover the truth behind the walls of the Marsh House.\n\nOmoide no Marnie tells the touching story of a young girl's journey through self-discovery and friendship, and the summer that she will remember for the rest of her life.\n\n[Written by MAL Rewrite]",
    score: 8.04,
    episodes: 1,
    mediaType: "movie",
  },
  whisper_of_the_heart: {
    malId: 585,
    title: "Mimi wo Sumaseba",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1764/138714.webp",
    synopsis:
      'Shizuku Tsukishima is an energetic 14-year-old girl who enjoys reading and writing poetry in her free time. Glancing at the checkout cards of her books one evening, she notices that her library books are frequently checked out by a boy named Seiji Amasawa. Curiosity strikes Shizuku, and she decides to search for the boy who shares her love for literature.\n\nMeeting a peculiar cat on the train, Shizuku follows the animal and is eventually led to a quaint antique shop, where she learns about a cat statuette known as "The Baron." Taking an interest in the shop, she surprisingly finds Seiji, and the two quickly befriend one another. Shizuku learns while acquainting herself with Seiji that he has a dream that he would like to fulfill, causing her dismay as she remains uncertain of her future and has yet to recognize her talents.\n\nHowever, as her relationship with Seiji grows, Shizuku becomes determined to work toward a goal. Guided by the whispers of her heart and inspiration from The Baron, she resolves to carve out her own potential and dreams.\n\n[Written by MAL Rewrite]\n',
    score: 8.22,
    episodes: 1,
    mediaType: "movie",
  },
  wolf_children: {
    malId: 12355,
    title: "Ookami Kodomo no Ame to Yuki",
    imageUrl: "https://cdn.myanimelist.net/images/anime/9/35721.webp",
    synopsis:
      "Hana, a hard-working college student, falls in love with a mysterious man who attends one of her classes though he is not an actual student. As it turns out, he is not truly human either. On a full moon night, he transforms, revealing that he is the last werewolf alive. Despite this, Hana's love remains strong, and the two ultimately decide to start a family.\n\nHana gives birth to two healthy children—Ame, born during rainfall, and Yuki, born during snowfall—both possessing the ability to turn into wolves, a trait inherited from their father. All too soon, however, the sudden death of her lover devastates Hana's life, leaving her to raise a peculiar family completely on her own. The stress of raising her wild-natured children in a densely populated city, all while keeping their identity a secret, culminates in a decision to move to the countryside, where she hopes Ame and Yuki can live a life free from the judgments of society. Wolf Children is the heartwarming story about the challenges of being a single mother in an unforgiving modern world.\n\n[Written by MAL Rewrite]",
    score: 8.56,
    episodes: 1,
    mediaType: "movie",
  },
  your_lie_in_april: {
    malId: 23273,
    title: "Shigatsu wa Kimi no Uso",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1405/143284.webp",
    synopsis:
      "Kousei Arima is a child prodigy known as the \"Human Metronome\" for playing the piano with precision and perfection. Guided by a strict mother and rigorous training, Kousei dominates every competition he enters, earning the admiration of his musical peers and praise from audiences. When his mother suddenly passes away, the subsequent trauma makes him unable to hear the sound of a piano, and he never takes the stage thereafter.\n\nNowadays, Kousei lives a quiet and unassuming life as a junior high school student alongside his friends Tsubaki Sawabe and Ryouta Watari. While struggling to get over his mother's death, he continues to cling to music. His monochrome life turns upside down the day he encounters the eccentric violinist Kaori Miyazono, who thrusts him back into the spotlight as her accompanist. Through a little lie, these two young musicians grow closer together as Kaori tries to fill Kousei's world with color.\n\n[Written by MAL Rewrite]\n",
    score: 8.64,
    episodes: 22,
    mediaType: "tv",
  },
  anohana_the_flower_we_saw_that_day: {
    malId: 9989,
    title: "Ano Hi Mita Hana no Namae wo Bokutachi wa Mada Shiranai.",
    imageUrl: "https://cdn.myanimelist.net/images/anime/5/79697.jpg",
    synopsis:
      "Jinta Yadomi is peacefully living as a recluse, spending his days away from school and playing video games at home instead. One hot summer day, his childhood friend, Meiko \"Menma\" Honma, appears and pesters him to grant a forgotten wish. He pays her no mind, which annoys her, but he doesn't really care. After all, Menma already died years ago.\n\nAt first, Jinta thinks that he is merely hallucinating due to the summer heat, but he is later on convinced that what he sees truly is the ghost of Menma. Jinta and his group of childhood friends grew apart after her untimely death, but they are drawn together once more as they try to lay Menma's spirit to rest. Re-living their pain and guilt, will they be able to find the strength to help not only Menma move on—but themselves as well?\n\n[Written by MAL Rewrite]",
    score: 8.29,
    episodes: 11,
    mediaType: "tv",
  },
  boku_no_hero_academia_season_1: {
    malId: 31964,
    title: "Boku no Hero Academia",
    imageUrl: "https://cdn.myanimelist.net/images/anime/10/78745.jpg",
    synopsis:
      "The appearance of \"quirks,\" newly discovered super powers, has been steadily increasing over the years, with 80 percent of humanity possessing various abilities from manipulation of elements to shapeshifting. This leaves the remainder of the world completely powerless, and Izuku Midoriya is one such individual.\n\nSince he was a child, the ambitious middle schooler has wanted nothing more than to be a hero. Izuku's unfair fate leaves him admiring heroes and taking notes on them whenever he can. But it seems that his persistence has borne some fruit: Izuku meets the number one hero and his personal idol, All Might. All Might's quirk is a unique ability that can be inherited, and he has chosen Izuku to be his successor!\n\nEnduring many months of grueling training, Izuku enrolls in UA High, a prestigious high school famous for its excellent hero training program, and this year's freshmen look especially promising. With his bizarre but talented classmates and the looming threat of a villainous organization, Izuku will soon learn what it really means to be a hero.\n\n[Written by MAL Rewrite]",
    score: 7.83,
    episodes: 13,
    mediaType: "tv",
  },
  cardcaptor_sakura: {
    malId: 232,
    title: "Cardcaptor Sakura",
    imageUrl: "https://cdn.myanimelist.net/images/anime/8/60781.webp",
    synopsis:
      'Ten-year-old Sakura Kinomoto is an ordinary fourth-grade student living in Tomoeda until, one day, she stumbles upon a mysterious book of cards titled "The Clow." Pondering over her discovery, she unintentionally causes a magical gust of wind to scatter the cards all over town.\n\nThe accident awakens the Beast of the Seal—Keroberos, nicknamed "Kero"—who tells Sakura that she has released the mystical "Clow Cards" created by the sorcerer Clow Reed. Due to each Card\'s ability to act independently and their incredible power, Clow had sealed them away. Now that they have been set free, the Cards pose great danger to the world, and it is up to Sakura to put an end to them.\n\nAppointing Sakura as the "Cardcaptor" and granting her the Sealed Key, Kero tasks her with finding and recapturing all the Clow Cards. Alongside her best friend Tomoyo Daidouji, and with Kero\'s guidance, Sakura must learn to balance her new secret duty with the everyday troubles as she takes flight on her magical adventures as Cardcaptor Sakura.\n\n[Written by MAL Rewrite]\n',
    score: 8.18,
    episodes: 70,
    mediaType: "tv",
  },
  clannad: {
    malId: 2167,
    title: "Clannad",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1804/95033.webp",
    synopsis:
      "Tomoya Okazaki is a delinquent who finds life dull and believes he'll never amount to anything. Along with his friend Youhei Sunohara, he skips school and plans to waste his high school days away.\n\nOne day while walking to school, Tomoya passes a young girl muttering quietly to herself. Without warning she exclaims \"Anpan!\" (a popular Japanese food) which catches Tomoya's attention. He soon discovers the girl's name is Nagisa Furukawa and that she exclaims things she likes in order to motivate herself. Nagisa claims they are now friends, but Tomoya walks away passing the encounter off as nothing.\n\nHowever, Tomoya finds he is noticing Nagisa more and more around school. Eventually he concedes and befriends her. Tomoya learns Nagisa has been held back a year due to a severe illness and that her dream is to revive the school's drama club. Claiming he has nothing better to do, he decides to help her achieve this goal along with the help of four other girls.\n\nAs Tomoya spends more time with the girls, he learns more about them and their problems. As he attempts to help each girl overcome her respective obstacle, he begins to realize life isn't as dull as he once thought.\n\n[Written by MAL Rewrite]",
    score: 7.99,
    episodes: 23,
    mediaType: "tv",
  },
  death_note: {
    malId: 1535,
    title: "Death Note",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1079/138100.jpg",
    synopsis:
      "Brutal murders, petty thefts, and senseless violence pollute the human world. In contrast, the realm of death gods is a humdrum, unchanging gambling den. The ingenious 17-year-old Japanese student Light Yagami and sadistic god of death Ryuk share one belief: their worlds are rotten.\n\nFor his own amusement, Ryuk drops his Death Note into the human world. Light stumbles upon it, deeming the first of its rules ridiculous: the human whose name is written in this note shall die. However, the temptation is too great, and Light experiments by writing a felon's name, which disturbingly enacts his first murder.\n\nAware of the terrifying godlike power that has fallen into his hands, Light—under the alias Kira—follows his wicked sense of justice with the ultimate goal of cleansing the world of all evil-doers. The meticulous mastermind detective L is already on his trail, but as Light's brilliance rivals L's, the grand chase for Kira turns into an intense battle of wits that can only end when one of them is dead.\n\n[Written by MAL Rewrite]\n",
    score: 8.62,
    episodes: 37,
    mediaType: "tv",
  },
  durarara__: {
    malId: 6746,
    title: "Durarara!!",
    imageUrl: "https://cdn.myanimelist.net/images/anime/10/71772.jpg",
    synopsis:
      "In Tokyo's downtown district of Ikebukuro, amidst many strange rumors and warnings of anonymous gangs and dangerous occupants, one urban legend stands out above the rest—the existence of a headless \"Black Rider\" who is said to be seen driving a jet-black motorcycle through the city streets.\n\nMikado Ryuugamine has always longed for the excitement of the city life, and an invitation from a childhood friend convinces him to move to Tokyo. Witnessing the Black Rider on his first day in the city, his wishes already seem to have been granted. But as supernatural events begin to occur, ordinary citizens like himself, along with Ikebukuro's most colorful inhabitants, are mixed up in the commotion breaking out in their city.\n\n[Written by MAL Rewrite]\n",
    score: 8.09,
    episodes: 24,
    mediaType: "tv",
  },
  fairy_tail: {
    malId: 6702,
    title: "Fairy Tail",
    imageUrl: "https://cdn.myanimelist.net/images/anime/5/18179.webp",
    synopsis:
      "In the enchanted Kingdom of Fiore, the lively Lucy Heartfilia has one wish: to join the renowned Fairy Tail—one of the many magical wizard guilds scattered around the continent. Luckily, a chance encounter with Natsu Dragneel, the \"Salamander\" of Fairy Tail, whisks her into the legendary guild.\n\nFrom Natsu's rivalrous antics with ice wizard Gray Fullbuster to the frightening presence of the unmatched combat goddess Erza Scarlet, Fairy Tail's powerful mages have a slight penchant for trouble. Through all the lucrative odd jobs and adventures to save the world from destruction lies an absolute and unyielding trust stronger than family that has formed between each guild member.\n\nTeaming up with Natsu, Gray, and Erza, Lucy finds herself amidst the guild's most misfit wizards. But as they constantly stand in the eye of every danger, there is one name that never ceases to resurface: Zeref, the feared master of dark magic.\n\n[Written by MAL Rewrite]\n",
    score: 7.57,
    episodes: 175,
    mediaType: "tv",
  },
  fate_zero: {
    malId: 10087,
    title: "Fate/Zero",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1887/117644.webp",
    synopsis:
      'With the promise of granting any wish, the omnipotent Holy Grail triggered three wars in the past, each too cruel and fierce to leave a victor. In spite of that, the wealthy Einzbern family is confident that the Fourth Holy Grail War will be different; namely, with a vessel of the Holy Grail now in their grasp. Solely for this reason, the much hated "Magus Killer" Kiritsugu Emiya is hired by the Einzberns, with marriage to their only daughter Irisviel as binding contract.\n\nKiritsugu now stands at the center of a cutthroat game of survival, facing off against six other participants, each armed with an ancient familiar, and fueled by unique desires and ideals. Accompanied by his own familiar, Saber, the notorious mercenary soon finds his greatest opponent in Kirei Kotomine, a priest who seeks salvation from the emptiness within himself in pursuit of Kiritsugu.\n\nBased on the light novel written by Gen Urobuchi, Fate/Zero depicts the events of the Fourth Holy Grail War—10 years prior to Fate/stay night. Witness a battle royale in which no one is guaranteed to survive.\n\n[Written by MAL Rewrite]',
    score: 8.26,
    episodes: 13,
    mediaType: "tv",
  },
  girls_band_cry: {
    malId: 56196,
    title: "Boku no Hero Academia the Movie 4: You're Next",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1480/143549.webp",
    synopsis:
      "Deku, Bakugo, Todoroki and the rest of U.A. High Class 1-A must face off against Dark Might and the obscure crime organisation under his control, the Gollini Family.\n\n",
    score: 7.52,
    episodes: 1,
    mediaType: "movie",
  },
  mahou_shoujo_madoka_magica: {
    malId: 9756,
    title: "Mahou Shoujo Madoka★Magica",
    imageUrl: "https://cdn.myanimelist.net/images/anime/11/55225.webp",
    synopsis:
      "Madoka Kaname and Sayaka Miki are regular middle school girls with regular lives, but all that changes when they encounter Kyuubey, a cat-like magical familiar, and Homura Akemi, the new transfer student.\n\nKyuubey offers them a proposition: he will grant any one of their wishes and in exchange, they will each become a magical girl, gaining enough power to fulfill their dreams. However, Homura Akemi, a magical girl herself, urges them not to accept the offer, stating that everything is not what it seems.\n\nA story of hope, despair, and friendship, Mahou Shoujo Madoka★Magica deals with the difficulties of being a magical girl and the price one has to pay to make a dream come true.\n\n[Written by MAL Rewrite] ",
    score: 8.38,
    episodes: 12,
    mediaType: "tv",
  },
  mononoke: {
    malId: 2246,
    title: "Mononoke",
    imageUrl: "https://cdn.myanimelist.net/images/anime/3/20713.webp",
    synopsis:
      'The "Medicine Seller" is a deadly and mysterious master of the occult who travels across feudal Japan in search of malevolent spirits called "mononoke" to slay. When he locates one of these spirits, he cannot simply kill it; he must first learn its Form, its Truth, and its Reason in order to wield the mighty Exorcism Sword and fight against it. He must begin  his strange exorcisms with intense psychological analysis and careful investigative work—an extremely dangerous step, as he must first confront and learn about the mononoke before he even has the means to defeat it.\n\nThe Medicine Seller\'s journey leads him to an old-fashioned inn where Shino, a pregnant woman, has finally found a place to rest. The owner has reluctantly placed her in the last vacant room; however, as she settles in, it quickly becomes clear that the room is infested by a lethal band of mononoke, the Zashiki Warashi. With his hunter\'s intuition, the Medicine Seller begins his investigation to discover the Form, the Truth, and the Reason before the Zashiki Warashi can kill again.\n\n[Written by MAL Rewrite]',
    score: 8.41,
    episodes: 12,
    mediaType: "tv",
  },
  psycho_pass: {
    malId: 13601,
    title: "Psycho-Pass",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1314/142015.webp",
    synopsis:
      "Justice, and the enforcement of it, has changed. In the 22nd century, Japan enforces the Sibyl System, an objective means of determining the threat level of each citizen by examining their mental state for signs of criminal intent, known as their Psycho-Pass. Inspectors uphold the law by subjugating, often with lethal force, anyone harboring the slightest ill-will; alongside them are Enforcers, citizens that have become latent criminals, granted relative freedom in exchange for carrying out the Inspectors' dirty work.\n\nInto this world steps Akane Tsunemori, a young woman with an honest desire to uphold justice. However, as she works alongside veteran Enforcer Shinya Kougami, she soon learns that the Sibyl System's judgments are not as perfect as her fellow Inspectors assume. With everything she has known turned on its head, Akane wrestles with the question of what justice truly is, and whether it can be upheld through the use of a system that may already be corrupt.\n\n[Written by MAL Rewrite]",
    score: 8.33,
    episodes: 22,
    mediaType: "tv",
  },
  re_zero___starting_life_in_another_world: {
    malId: 31240,
    title: "Re:Zero kara Hajimeru Isekai Seikatsu",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1522/128039.webp",
    synopsis:
      "When Subaru Natsuki leaves the convenience store, the last thing he expects is to be wrenched from his everyday life and dropped into a fantasy world. Things are not looking good for the bewildered teenager; however, not long after his arrival, he is attacked by some thugs. Armed with only a bag of groceries and a now useless cell phone, he is quickly beaten to a pulp. Fortunately, a mysterious beauty named Satella, in hot pursuit after the one who stole her insignia, happens upon Subaru and saves him. In order to thank the honest and kindhearted girl, Subaru offers to help in her search, and later that night, he even finds the whereabouts of that which she seeks. But unbeknownst to them, a much darker force stalks the pair from the shadows, and just minutes after locating the insignia, Subaru and Satella are brutally murdered.\n\nHowever, Subaru immediately reawakens to a familiar scene—confronted by the same group of thugs, meeting Satella all over again—the enigma deepens as history inexplicably repeats itself.\n\n[Written by MAL Rewrite]",
    score: 8.24,
    episodes: 25,
    mediaType: "tv",
  },
  relife: {
    malId: 30015,
    title: "ReLIFE",
    imageUrl: "https://cdn.myanimelist.net/images/anime/3/82149.webp",
    synopsis:
      "Dismissed as a hopeless loser by those around him, 27-year-old Arata Kaizaki bounces around from one job to another after quitting his first company. His unremarkable existence takes a sharp turn when he meets Ryou Yoake, a member of the ReLife Research Institute, who offers Arata the opportunity to change his life for the better with the help of a mysterious pill. Taking it without a second thought, Arata awakens the next day to find that his appearance has reverted to that of a 17-year-old.\n\nArata soon learns that he is now the subject of a unique experiment and must attend high school as a transfer student for one year. Though he initially believes it will be a cinch due to his superior life experience, Arata is proven horribly wrong on his first day: he flunks all his tests, is completely out of shape, and can't keep up with the new school policies that have cropped up in the last 10 years. Furthermore, Ryou has been assigned to observe him, bringing Arata endless annoyance. ReLIFE follows Arata's struggle to adjust to his hectic new lifestyle and avoid repeating his past mistakes, all while slowly discovering more about his fellow classmates.\n\n[Written by MAL Rewrite]",
    score: 7.96,
    episodes: 13,
    mediaType: "tv",
  },
  steins_gate: {
    malId: 9253,
    title: "Steins;Gate",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1935/127974.jpg",
    synopsis:
      'Eccentric scientist Rintarou Okabe has a never-ending thirst for scientific exploration. Together with his ditzy but well-meaning friend Mayuri Shiina and his roommate Itaru Hashida, Okabe founds the Future Gadget Laboratory in the hopes of creating technological innovations that baffle the human psyche. Despite claims of grandeur, the only notable "gadget" the trio have created is a microwave that has the mystifying power to turn bananas into green goo.\n\nHowever, when Okabe attends a conference on time travel, he experiences a series of strange events that lead him to believe that there is more to the "Phone Microwave" gadget than meets the eye. Apparently able to send text messages into the past using the microwave, Okabe dabbles further with the "time machine," attracting the ire and attention of the mysterious organization SERN.\n\nDue to the novel discovery, Okabe and his friends find themselves in an ever-present danger. As he works to mitigate the damage his invention has caused to the timeline, Okabe fights a battle to not only save his loved ones but also to preserve his degrading sanity.\n\n[Written by MAL Rewrite]',
    score: 9.07,
    episodes: 24,
    mediaType: "tv",
  },
  sword_art_online: {
    malId: 11757,
    title: "Sword Art Online",
    imageUrl: "https://cdn.myanimelist.net/images/anime/11/39717.webp",
    synopsis:
      "Ever since the release of the innovative NerveGear, gamers from all around the globe have been given the opportunity to experience a completely immersive virtual reality. Sword Art Online (SAO), one of the most recent games on the console, offers a gateway into the wondrous world of Aincrad, a vivid, medieval landscape where users can do anything within the limits of imagination. With the release of this worldwide sensation, gaming has never felt more lifelike.\n\nHowever, the idyllic fantasy rapidly becomes a brutal nightmare when SAO's creator traps thousands of players inside the game. The \"log-out\" function has been removed, with the only method of escape involving beating all of Aincrad's one hundred increasingly difficult levels. Adding to the struggle, any in-game death becomes permanent, ending the player's life in the real world.\n\nWhile Kazuto \"Kirito\" Kirigaya was fortunate enough to be a beta-tester for the game, he quickly finds that despite his advantages, he cannot overcome SAO's challenges alone. Teaming up with Asuna Yuuki and other talented players, Kirito makes an effort to face the seemingly insurmountable trials head-on. But with difficult bosses and threatening dark cults impeding his progress, Kirito finds that such tasks are much easier said than done.\n\n[Written by MAL Rewrite]",
    score: 7.22,
    episodes: 25,
    mediaType: "tv",
  },
  your_name: {
    malId: 32281,
    title: "Kimi no Na wa.",
    imageUrl: "https://cdn.myanimelist.net/images/anime/5/87048.jpg",
    synopsis:
      "Mitsuha Miyamizu, a high school girl, yearns to live the life of a boy in the bustling city of Tokyo—a dream that stands in stark contrast to her present life in the countryside. Meanwhile in the city, Taki Tachibana lives a busy life as a high school student while juggling his part-time job and hopes for a future in architecture.\n\nOne day, Mitsuha awakens in a room that is not her own and suddenly finds herself living the dream life in Tokyo—but in Taki's body! Elsewhere, Taki finds himself living Mitsuha's life in the humble countryside. In pursuit of an answer to this strange phenomenon, they begin to search for one another.\n\nKimi no Na wa. revolves around Mitsuha and Taki's actions, which begin to have a dramatic impact on each other's lives, weaving them into a fabric held together by fate and circumstance.\n\n[Written by MAL Rewrite]",
    score: 8.83,
    episodes: 1,
    mediaType: "movie",
  },
};
