/**
 * i18n message catalogue. English is authoritative. chiShona (sn) and isiNdebele (nd) are drafts written for a native
 * speaker to check: every entry with `needsReview: true` must be reviewed before launch (see docs/PROGRESS.md).
 * Placeholders use {name}. WhatsApp formatting (*bold*) is allowed in bot messages.
 */
export interface Entry {
  en: string;
  sn: string;
  nd: string;
  needsReview?: boolean;
}

const d = (en: string, sn: string, nd: string): Entry => ({ en, sn, nd, needsReview: true });
/** Same text in every language (brand names, language names, numbers). */
const same = (s: string): Entry => ({ en: s, sn: s, nd: s });

export const catalogue = {
  // ------------------------------------------------------------------ common
  'common.yes': d('Yes', 'Hongu', 'Yebo'),
  'common.no': d('No', 'Kwete', 'Hatshi'),
  'common.skip': d('Skip', 'Darika', 'Yeqa'),
  'common.done': d('Done', 'Zvapera', 'Sengiqedile'),
  'common.cancel': d('Cancel', 'Kanzura', 'Khansela'),
  'common.continue': d('Continue', 'Enderera', 'Qhubeka'),
  'common.choose': d('Choose', 'Sarudza', 'Khetha'),
  'common.menu_hint': d(
    'Send *menu* at any time to see the main menu.',
    'Tumira *menu* chero nguva kuti uone menyu huru.',
    'Thumela *menu* nini lanini ukuze ubone imenyu enkulu.',
  ),
  'common.not_understood': d(
    "Sorry, I didn't understand that. Please use the buttons, or send *menu*.",
    'Ndine urombo, handina kunzwisisa. Shandisa mabhatani, kana tumira *menu*.',
    'Uxolo, angizwisisanga. Sebenzisa amabhatani, kumbe uthumele *menu*.',
  ),
  'common.cancelled': d('Cancelled. Nothing was saved.', 'Zvakanzurwa. Hapana chakachengetwa.', 'Kukhanseliwe. Akulalutho olugciniweyo.'),
  'common.error': d(
    'Something went wrong on our side. Please try again in a moment.',
    'Pane chakanganisika kwatiri. Edza zvakare munguva pfupi.',
    'Kukhona okungahambanga kahle kithi. Zama futhi masinyane.',
  ),
  'common.not_given': d('not given', 'hazvina kupihwa', 'akunikwanga'),
  'common.private': d('private', 'zvakavanzika', 'okuyimfihlo'),
  'common.none': d('none', 'hapana', 'akukho'),
  'common.received': d('received', 'yagamuchirwa', 'yamukelwe'),

  'lang.en': same('English'),
  'lang.sn': same('chiShona'),
  'lang.nd': same('isiNdebele'),

  'level.starter': d('Starter', 'Starter', 'Starter'),
  'level.bronze': d('Bronze', 'Bronze', 'Bronze'),
  'level.silver': d('Silver', 'Silver', 'Silver'),
  'level.gold': d('Gold', 'Gold', 'Gold'),
  'level.shown.starter': d('New member', 'Nhengo itsva', 'Ilunga elitsha'),
  'level.shown.bronze': d('Verified jobs', 'Mabasa akasimbiswa', 'Imisebenzi eqinisekisiweyo'),
  'level.shown.silver': d('Endorsed artisan', 'Mhizha yakatsigirwa', 'Ingcitshi esekelweyo'),
  'level.shown.gold': d('Trade-test ready', 'Yakagadzirira trade test', 'Ilungele i-trade test'),

  // ------------------------------------------------------------------ onboarding
  'ob.welcome': same(
    'Welcome to *Skills Passport*.\nMauya ku *Skills Passport*.\nSiyalemukela ku *Skills Passport*.\n\nChoose your language · Sarudza mutauro · Khetha ulimi',
  ),
  'ob.birth_year': d(
    'What year were you born? For example: 1999',
    'Makazvarwa gore ripi? Semuenzaniso: 1999',
    'Wazalwa ngonyaka bani? Isibonelo: 1999',
  ),
  'ob.birth_year_invalid': d(
    'Please send the year as four numbers, for example 1999.',
    'Tumira gore senhamba ina, semuenzaniso 1999.',
    'Thumela umnyaka ngezinombolo ezine, isibonelo 1999.',
  ),
  'ob.birth_month': d(
    'Which month were you born? Send a number from 1 to 12.',
    'Makazvarwa mwedzi upi? Tumira nhamba kubva pa1 kusvika pa12.',
    'Wazalwa ngenyanga bani? Thumela inombolo kusukela ku-1 kusiya ku-12.',
  ),
  'ob.birth_month_invalid': d(
    'Please send a number from 1 to 12.',
    'Tumira nhamba kubva pa1 kusvika pa12.',
    'Thumela inombolo kusukela ku-1 kusiya ku-12.',
  ),
  'ob.age_out': d(
    'Skills Passport is for artisans aged 18 to 35. Thank you for your interest.',
    'Skills Passport ndeyemhizha dzine makore 18 kusvika 35. Tinotenda nekufarira kwenyu.',
    'I-Skills Passport ngeyezingcitshi ezileminyaka eyi-18 kusiya kweyi-35. Siyabonga ngokuthakazelela kwenu.',
  ),
  'ob.residency': d(
    'Do you live and work in Zimbabwe?',
    'Munogara uye munoshanda muZimbabwe here?',
    'Uhlala njalo usebenza eZimbabwe yini?',
  ),
  'ob.residency_no': d(
    'Skills Passport is only available in Zimbabwe for now. Thank you for your interest.',
    'Skills Passport iri muZimbabwe chete parizvino. Tinotenda nekufarira kwenyu.',
    'I-Skills Passport itholakala eZimbabwe kuphela okwamanje. Siyabonga ngokuthakazelela kwenu.',
  ),
  'ob.consent': d(
    'Before we start, here is how we use your information:\n\n• We keep your name, phone number, trade and area.\n• Your public passport shows your first name, trade, suburb, confirmed jobs, ratings and the work photos you choose.\n• We never show your phone number, exact location or what you charged.\n• We send each client one WhatsApp message asking them to confirm the job.\n• You can delete your account at any time.\n\nDo you agree?',
    'Tisati tatanga, hezvi zvatinoita neruzivo rwenyu:\n\n• Tinochengeta zita renyu, nhamba yefoni, basa renyu nenzvimbo.\n• Passport yenyu inoratidza zita rekutanga, basa, sabhabhu, mabasa akasimbiswa, mamaki nemifananidzo yamunosarudza.\n• Hatimbofi takaratidza nhamba yefoni, nzvimbo chaiyo kana mari yamakabhadharisa.\n• Tinotumira mutengi wega wega meseji imwe yeWhatsApp kuti asimbise basa.\n• Munogona kudzima account yenyu chero nguva.\n\nMunobvuma here?',
    'Singakaqali, nansi indlela esisebenzisa ngayo ulwazi lwakho:\n\n• Sigcina ibizo lakho, inombolo yefoni, umsebenzi wakho lendawo.\n• I-passport yakho ikhombisa ibizo lakho lokuqala, umsebenzi, isabhabhu, imisebenzi eqinisekisiweyo, amamaki lemifanekiso oyikhethayo.\n• Kasisoze sikhombise inombolo yefoni, indawo eqondileyo kumbe imali oyibhadalisileyo.\n• Sithumela umthengi ngamunye umlayezo owodwa we-WhatsApp ukuthi aqinisekise umsebenzi.\n• Ungacima i-akhawunti yakho nini lanini.\n\nUyavuma yini?',
  ),
  'ob.btn.agree': d('I agree', 'Ndinobvuma', 'Ngiyavuma'),
  'ob.btn.listen': d('Listen instead', 'Teerera', 'Lalela'),
  'ob.btn.decline': d('No thanks', 'Kwete, ndatenda', 'Hatshi, ngiyabonga'),
  'ob.consent_voice_caption': d('How we use your information', 'Zvatinoita neruzivo rwenyu', 'Indlela esisebenzisa ngayo ulwazi lwakho'),
  'ob.consent_declined': d(
    'No problem. We have not saved anything. Send *hi* if you change your mind.',
    'Hapana dambudziko. Hatina kuchengeta chinhu. Tumira *hi* kana mukachinja pfungwa.',
    'Akulandaba. Kasigcinanga lutho. Thumela *hi* nxa ungaguqula umqondo.',
  ),
  'ob.name': d(
    'What is your first name and surname?',
    'Zita renyu nemusoro wenyu ndiani?',
    'Ibizo lakho lesibongo ngubani?',
  ),
  'ob.name_invalid': d(
    'Please send your first name and surname, for example: Tendai Moyo.',
    'Tumira zita nemusoro, semuenzaniso: Tendai Moyo.',
    'Thumela ibizo lesibongo, isibonelo: Tendai Moyo.',
  ),
  'ob.trade': d('What is your trade?', 'Basa renyu remaoko nderipi?', 'Umsebenzi wakho wezandla ngowuphi?'),
  'ob.trade_more': d(
    'Added *{trade}*. Do you also work in a second trade?',
    'Tawedzera *{trade}*. Munoshandawo here mune rimwe basa?',
    'Sengengeze *{trade}*. Uyasebenza yini lakomunye umsebenzi?',
  ),
  'ob.btn.add_trade': d('Add a second trade', 'Wedzera rimwe basa', 'Engeza omunye'),
  'ob.city': d('Which city do you work in?', 'Munoshanda muguta ripi?', 'Usebenza kuliphi idolobho?'),
  'ob.area': d('Which area do you mostly work in?', 'Munonyanya kushanda munzvimbo ipi?', 'Uvame ukusebenza kuyiphi indawo?'),
  'ob.area_other': d("My area isn't listed", 'Nzvimbo yangu haimo', 'Indawo yami ayikho'),
  'ob.area_other_ack': d(
    "Thanks. A field agent will add your area. For now we'll use {area}.",
    'Tatenda. Mumiriri achawedzera nzvimbo yenyu. Parizvino tichashandisa {area}.',
    'Siyabonga. Umsebenzi wasendaweni uzakwengeza indawo yakho. Okwamanje sizasebenzisa {area}.',
  ),
  'ob.experience': d(
    'How many years have you worked in this trade?',
    'Mava nemakore mangani muchiita basa iri?',
    'Usuleminyaka emingaki wenza lumsebenzi?',
  ),
  'exp.0': d('Less than 1 year', 'Pasi pegore 1', 'Ngaphansi komnyaka o-1'),
  'exp.1': d('1–2 years', 'Makore 1–2', 'Iminyaka e-1–2'),
  'exp.3': d('3–5 years', 'Makore 3–5', 'Iminyaka e-3–5'),
  'exp.6': d('6–10 years', 'Makore 6–10', 'Iminyaka e-6–10'),
  'exp.10': d('More than 10 years', 'Kupfuura makore 10', 'Iminyaka engaphezu kwe-10'),
  'ob.how_learned': d('How did you learn your trade?', 'Makadzidza sei basa renyu?', 'Wafunda njani umsebenzi wakho?'),
  'learned.apprenticeship': d('Apprenticeship', 'Kudzidziswa nemhizha', 'Ukufundiswa yingcitshi'),
  'learned.family': d('From family', 'Kubva kumhuri', 'Emndenini'),
  'learned.self_taught': d('Taught myself', 'Ndakazvidzidzisa', 'Ngazifundisa'),
  'learned.college': d('College or training centre', 'Koreji kana training centre', 'Ikholeji kumbe isikhungo'),
  'learned.other': d('Other', 'Zvimwe', 'Okunye'),
  'ob.demographics': d(
    'Optional: may we ask about gender and disability? We use this only in anonymous reports about who Skills Passport reaches, unless you choose to show a badge.',
    'Hazvimanikidzwi: tingabvunza here nezve kuti muri munhurume kana munhukadzi uye kuremara? Tinozvishandisa mumishumo isina mazita chete, kunze kwekunge masarudza kuratidza bheji.',
    'Akusibopho: singabuza yini ngobulili lokukhubazeka? Sikusebenzisa emibikweni engelamabizo kuphela, ngaphandle kokuthi ukhethe ukukhombisa ibheji.',
  ),
  'ob.btn.ask_me': d('Yes, ask me', 'Hongu, bvunzai', 'Yebo, ngibuza'),
  'ob.gender': d('What is your gender?', 'Muri munhurume kana munhukadzi?', 'Ubulili bakho ngobuphi?'),
  'gender.woman': d('Woman', 'Mukadzi', 'Owesifazane'),
  'gender.man': d('Man', 'Murume', 'Owesilisa'),
  'gender.prefer_not': d('Prefer not to say', 'Handidi kutaura', 'Angithandi ukutsho'),
  'ob.disability': d('Do you live with a disability?', 'Mune hurema here?', 'Ulokukhubazeka yini?'),
  'ob.badge_women': d(
    'Would you like a *Women in Trades* badge on your public passport?',
    'Mungada here bheji re*Women in Trades* papassport yenyu?',
    'Ungathanda yini ibheji ye-*Women in Trades* ku-passport yakho?',
  ),
  'ob.photo': d(
    'Last step: send a profile photo, or tap Skip. A clear photo of you at work builds trust.',
    'Danho rekupedzisira: tumira mufananidzo wenyu, kana dzvanya Darika. Mufananidzo wakajeka muri kubasa unovaka kuvimbika.',
    'Isinyathelo sokucina: thumela umfanekiso wakho, kumbe ucindezele Yeqa. Umfanekiso ocacileyo usemsebenzini wakha ukuthenjwa.',
  ),
  'ob.done': d(
    'Your Skills Passport is ready.\n\nPassport number: *{code}*\nLevel: Starter\nYour page: {link}\n\nNext: log your first job. After each job, send photos and a short voice note, and your client confirms with one tap.',
    'Skills Passport yenyu yagadzirira.\n\nNhamba yepassport: *{code}*\nChikamu: Starter\nPeji renyu: {link}\n\nZvinotevera: nyorai basa renyu rekutanga. Mushure mebasa rega rega, tumirai mifananidzo nevoice note pfupi, mutengi wenyu osimbisa nekudzvanya kamwe chete.',
    'I-Skills Passport yakho isilungile.\n\nInombolo ye-passport: *{code}*\nIsigaba: Starter\nIkhasi lakho: {link}\n\nOkulandelayo: bhala umsebenzi wakho wokuqala. Ngemva komsebenzi ngamunye, thumela imifanekiso le-voice note emfitshane, umthengi wakho aqinisekise ngokucindezela kanye.',
  ),
  'ob.btn.log_first': d('Log my first job', 'Nyora basa rekutanga', 'Bhala umsebenzi wokuqala'),
  'ob.already': d(
    'You already have a Skills Passport ({code}).',
    'Mune Skills Passport kare ({code}).',
    'Usulayo i-Skills Passport ({code}).',
  ),

  // ------------------------------------------------------------------ main menu
  'menu.body': d('Hi {name}. What would you like to do?', 'Mhoro {name}. Mungada kuitei?', 'Sawubona {name}. Ungathanda ukwenzani?'),
  'menu.button': d('Menu', 'Menyu', 'Imenyu'),
  'menu.log_job': d('Log a job', 'Nyora basa', 'Bhala umsebenzi'),
  'menu.log_job.desc': d('Photos, voice note, client', 'Mifananidzo, voice note, mutengi', 'Imifanekiso, i-voice note, umthengi'),
  'menu.passport': d('My passport', 'Passport yangu', 'I-passport yami'),
  'menu.passport.desc': d("Level and what's next", 'Chikamu nezvinotevera', 'Isigaba lokulandelayo'),
  'menu.waiting': d('Waiting for clients', 'Zvakamirira vatengi', 'Okulindele abathengi'),
  'menu.waiting.desc': d('Jobs not yet confirmed', 'Mabasa asati asimbiswa', 'Imisebenzi engakaqinisekiswa'),
  'menu.share': d('Share my passport', 'Govera passport yangu', 'Yabelana nge-passport'),
  'menu.share.desc': d('Link, QR code, Status card', 'Link, QR code, kadhi reStatus', 'I-link, i-QR code, ikhadi le-Status'),
  'menu.work_requests': d('Work requests', 'Zvikumbiro zvebasa', 'Izicelo zomsebenzi'),
  'menu.work_requests.desc': d('Requests from buyers', 'Kubva kuvatengi', 'Ezivela kubathengi'),
  'menu.help': d('Help', 'Rubatsiro', 'Uncedo'),
  'menu.help.desc': d('Questions, field agent, report a client', 'Mibvunzo, mumiriri, kumhan’ara mutengi', 'Imibuzo, umsebenzi wasendaweni, ukubika umthengi'),
  'menu.settings': d('Settings', 'Zvirongwa', 'Izilungiselelo'),
  'menu.settings.desc': d('Language, profile, account', 'Mutauro, profile, account', 'Ulimi, iphrofayili, i-akhawunti'),

  // ------------------------------------------------------------------ log a job
  'job.choose_trade': d('Which trade was this job?', 'Basa iri raive rerudzii?', 'Lumsebenzi ubungowaluphi uhlobo?'),
  'job.choose_type': d('What kind of job was it?', 'Raive basa rakaita sei?', 'Ubungumsebenzi onjani?'),
  'job.before': d(
    'Send 1 to {max} photos from *before* you started.',
    'Tumira mifananidzo 1 kusvika {max} *usati* watanga basa.',
    'Thumela imifanekiso e-1 kusiya ku-{max} *ungakaqali* umsebenzi.',
  ),
  'job.before_optional': d(
    'Optional: send up to {max} photos from *before* you started, or tap Skip.',
    'Hazvimanikidzwi: tumira mifananidzo inosvika {max} *usati* watanga, kana dzvanya Darika.',
    'Akusibopho: thumela imifanekiso efika ku-{max} *ungakaqali*, kumbe ucindezele Yeqa.',
  ),
  'job.after': d(
    'Now send 1 to {max} photos of the *finished* work. You can also send one video of up to 60 seconds.',
    'Zvino tumira mifananidzo 1 kusvika {max} yebasa *rapera*. Unogonawo kutumira vhidhiyo imwe isingapfuuri 60 seconds.',
    'Khathesi thumela imifanekiso e-1 kusiya ku-{max} yomsebenzi *oseqediwe*. Ungathumela levidiyo eyodwa engedluli imizuzwana engu-60.',
  ),
  'job.media_more': d(
    'Got it ({count}). Send more, or tap Done.',
    'Zvagamuchirwa ({count}). Tumira zvimwe, kana dzvanya Zvapera.',
    'Kwamukelwe ({count}). Thumela okunye, kumbe ucindezele Sengiqedile.',
  ),
  'job.need_photo': d('Please send at least one photo first.', 'Tanga watumira mufananidzo mumwe chete.', 'Qala uthumele umfanekiso owodwa.'),
  'job.too_many': d(
    "That's the maximum for this step. Tap Done to continue.",
    'Ndizvo zvakawanda zvinobvumirwa. Dzvanya Zvapera kuti uenderere.',
    'Lokho yikho okunengi okuvunyelweyo. Cindezela Sengiqedile ukuze uqhubeke.',
  ),
  'job.video_too_long': d(
    'That video is longer than {max} seconds. Please send a shorter one.',
    'Vhidhiyo iyi yakareba kupfuura {max} seconds. Tumira ipfupi.',
    'Ividiyo le yinde kulemizuzwana engu-{max}. Thumela emfitshane.',
  ),
  'job.voice': d(
    'Send a voice note (up to 2 minutes): what you did, the materials you used and any problem you solved.\n\nPrefer questions? Tap *Answer 3 questions*.',
    'Tumira voice note (isingapfuuri maminitsi 2): zvawaita, zvinhu zvawashandisa nedambudziko rawagadzirisa.\n\nUnoda mibvunzo here? Dzvanya *Pindura mibvunzo 3*.',
    'Thumela i-voice note (engedluli imizuzu emi-2): okwenzileyo, izinto osebenzise zona lenkinga oyixazululileyo.\n\nUthanda imibuzo? Cindezela *Phendula imibuzo emi-3*.',
  ),
  'job.btn.questions': d('Answer 3 questions', 'Pindura mibvunzo 3', 'Phendula imibuzo emi-3'),
  'job.q1': d(
    '1 of 3: What did you do on this job? Send a voice note or text.',
    '1 pa3: Wakaitei pabasa iri? Tumira voice note kana meseji.',
    '1 kwemi-3: Wenzeni kulumsebenzi? Thumela i-voice note kumbe umbhalo.',
  ),
  'job.q2': d('2 of 3: What materials did you use?', '2 pa3: Wakashandisa zvinhu zvipi?', '2 kwemi-3: Usebenzise ziphi izinto?'),
  'job.q3': d(
    '3 of 3: Was there a problem you had to solve? How did you solve it?',
    '3 pa3: Pane dambudziko rawakasangana naro here? Wakarigadzirisa sei?',
    '3 kwemi-3: Ikhona inkinga ohlangabezane layo yini? Uyixazulule njani?',
  ),
  'job.voice_too_long': d(
    'That voice note is longer than 2 minutes. Please send a shorter one.',
    'Voice note iyi yakareba kupfuura maminitsi 2. Tumira ipfupi.',
    'I-voice note le yinde kulemizuzu emi-2. Thumela emfitshane.',
  ),
  'job.need_voice': d(
    'Please send a voice note, or tap *Answer 3 questions*.',
    'Tumira voice note, kana dzvanya *Pindura mibvunzo 3*.',
    'Thumela i-voice note, kumbe ucindezele *Phendula imibuzo emi-3*.',
  ),
  'job.client_name': d("What is the client's name?", 'Mutengi anonzi ani?', 'Umthengi ngubani ibizo lakhe?'),
  'job.client_phone': d(
    "What is the client's phone number? You can also share their WhatsApp contact.",
    'Nhamba yefoni yemutengi ndeipi? Unogonawo kugovera contact yake yeWhatsApp.',
    'Inombolo yefoni yomthengi ngubani? Ungabelana lathi nge-contact yakhe ye-WhatsApp.',
  ),
  'job.client_phone_invalid': d(
    "That doesn't look like a valid mobile number. Try 077 123 4567 or +263 77 123 4567.",
    'Iyi haiite senhamba chaiyo. Edza 077 123 4567 kana +263 77 123 4567.',
    'Lokhu akubukeki njengenombolo eqondileyo. Zama 077 123 4567 kumbe +263 77 123 4567.',
  ),
  'job.client_phone_own': d(
    "You can't confirm your own job. Please send your client's number.",
    'Haugoni kusimbisa basa rako pachako. Tumira nhamba yemutengi.',
    'Ngeke uqinisekise umsebenzi wakho ngokwakho. Thumela inombolo yomthengi.',
  ),
  'job.client_phone_registered': d(
    "That number belongs to a registered artisan or verifier. Please send your client's own number.",
    'Nhamba iyi ndeyemhizha kana muongorori akanyoreswa. Tumira nhamba yemutengi chaiyo.',
    'Inombolo le ngeyengcitshi kumbe umhloli obhalisiweyo. Thumela inombolo yomthengi uqobo.',
  ),
  'job.client_blocked': d(
    "That client can't confirm jobs on Skills Passport. Please choose a different client.",
    'Mutengi uyu haagoni kusimbisa mabasa paSkills Passport. Sarudza mumwe mutengi.',
    'Umthengi lo angeke aqinisekise imisebenzi ku-Skills Passport. Khetha omunye umthengi.',
  ),
  'job.date': d('When did you do this job?', 'Basa iri wakariita riini?', 'Lumsebenzi uwenze nini?'),
  'job.btn.today': d('Today', 'Nhasi', 'Lamuhla'),
  'job.btn.yesterday': d('Yesterday', 'Nezuro', 'Izolo'),
  'job.btn.other_date': d('Another date', 'Rimwe zuva', 'Olunye usuku'),
  'job.date_ask': d(
    'Send the date as day/month, for example 12/11.',
    'Tumira zuva sezuva/mwedzi, semuenzaniso 12/11.',
    'Thumela usuku njengosuku/inyanga, isibonelo 12/11.',
  ),
  'job.date_invalid': d(
    'Please send a date within the last 90 days as day/month, for example 12/11.',
    'Tumira zuva riri mukati memazuva 90 apfuura sezuva/mwedzi, semuenzaniso 12/11.',
    'Thumela usuku olungaphakathi kwensuku ezingu-90 ezedlulileyo, isibonelo 12/11.',
  ),
  'job.area': d('Was the job in {area}?', 'Basa raive mu{area} here?', 'Umsebenzi ubuse-{area} yini?'),
  'job.btn.other_area': d('Different area', 'Imwe nzvimbo', 'Enye indawo'),
  'job.location': d(
    'Optional: share the job location. It adds trust and is never shown publicly. Tap the attach button, then Location — or tap Skip.',
    'Hazvimanikidzwi: govera nzvimbo yebasa. Zvinowedzera kuvimbika uye hazviratidzwe pachena. Dzvanya bhatani rekubatanidza, wozoti Location — kana dzvanya Darika.',
    'Akusibopho: yabelana ngendawo yomsebenzi. Kwengeza ukuthenjwa futhi kakukhonjiswa obala. Cindezela inkinobho yokunamathisela, ubusukhetha Location — kumbe ucindezele Yeqa.',
  ),
  'job.amount': d(
    'Optional: how much did you charge, in US dollars? This stays private. Send a number like 45, or tap Skip.',
    'Hazvimanikidzwi: wakabhadharisa marii, muUS dollars? Izvi zvinoramba zvakavanzika. Tumira nhamba yakaita se45, kana dzvanya Darika.',
    'Akusibopho: ubhadalise malini, nge-US dollar? Lokhu kuhlala kuyimfihlo. Thumela inombolo efana lo-45, kumbe ucindezele Yeqa.',
  ),
  'job.amount_invalid': d(
    'Please send a number like 45 or 45.50, or tap Skip.',
    'Tumira nhamba yakaita se45 kana 45.50, kana dzvanya Darika.',
    'Thumela inombolo efana lo-45 kumbe 45.50, kumbe ucindezele Yeqa.',
  ),
  'job.summary': d(
    'Please check your job:\n\n*{jobType}*\nDate: {date}\nArea: {area}\nPhotos: {photos}\nVoice note: {voice}\nClient: {client}\nAmount: {amount}\n\nSubmit it?',
    'Tarisa basa rako:\n\n*{jobType}*\nZuva: {date}\nNzvimbo: {area}\nMifananidzo: {photos}\nVoice note: {voice}\nMutengi: {client}\nMari: {amount}\n\nRitumire here?',
    'Hlola umsebenzi wakho:\n\n*{jobType}*\nUsuku: {date}\nIndawo: {area}\nImifanekiso: {photos}\nI-voice note: {voice}\nUmthengi: {client}\nImali: {amount}\n\nUwuthumele yini?',
  ),
  'job.btn.submit': d('Submit', 'Tumira', 'Thumela'),
  'job.btn.restart': d('Start again', 'Tanga patsva', 'Qala kutsha'),
  'job.submitted': d(
    'Job *{ref}* submitted.\n\nWe are sending {client} a WhatsApp message to confirm it. We will tell you when they reply.',
    'Basa *{ref}* ratumirwa.\n\nTiri kutumira {client} meseji yeWhatsApp kuti asimbise. Tichakuudza kana vapindura.',
    'Umsebenzi *{ref}* uthunyelwe.\n\nSithumela u-{client} umlayezo we-WhatsApp ukuthi aqinisekise. Sizakwazisa nxa ephendula.',
  ),
  'job.retake': d(
    'Photo {n} looks too {problem}. Please take it again in good light, holding the phone steady.',
    'Mufananidzo {n} wakanyanya ku{problem}. Tora zvakare pachiedza chakanaka, wakabata foni zvakasimba.',
    'Umfanekiso {n} ubukeka u{problem} kakhulu. Wuthathe futhi ekukhanyeni okuhle, ubambe ifoni iqine.',
  ),
  'job.problem.dark': d('dark', 'dema', 'mnyama'),
  'job.problem.blurry': d('blurry', 'kusajeka', 'ungacacanga'),
  'job.resume': d(
    'You were logging a job ({jobType}). Continue where you left off?',
    'Wanga uchinyora basa ({jobType}). Enderera pawasiya here?',
    'Ububhala umsebenzi ({jobType}). Uqhubeke lapho omise khona yini?',
  ),
  'job.btn.discard': d('Discard it', 'Rasa', 'Lahla'),
  'job.discarded': d('Discarded.', 'Zvarasirwa.', 'Kulahliwe.'),
  'job.no_types': d(
    'There are no job types set up for your trade yet. A field agent will help you.',
    'Hapana mhando dzemabasa dzakagadzirirwa basa renyu parizvino. Mumiriri achakubatsira.',
    'Azikho izinhlobo zemisebenzi ezilungiselelwe umsebenzi wakho okwamanje. Umsebenzi wasendaweni uzakunceda.',
  ),

  // AI summary check (PLAN Q1)
  'sum.check': d(
    'Here is how we described job *{ref}*:\n\n{summary}\n\nIs this right?',
    'Hezvi zvatanyora nezvebasa *{ref}*:\n\n{summary}\n\nZvakarurama here?',
    'Nansi indlela esichaze ngayo umsebenzi *{ref}*:\n\n{summary}\n\nKuqondile yini?',
  ),
  'sum.btn.ok': d('Looks right', 'Zvakarurama', 'Kuqondile'),
  'sum.btn.fix': d('Fix it', 'Gadzirisa', 'Lungisa'),
  'sum.fix_prompt': d(
    'Send the correct description as a text or voice note.',
    'Tumira tsananguro chaiyo semeseji kana voice note.',
    'Thumela incazelo eqondileyo ngombhalo kumbe nge-voice note.',
  ),
  'sum.fixed': d(
    'Thanks. We updated the description for {ref}.',
    'Tatenda. Tagadzirisa tsananguro ye{ref}.',
    'Siyabonga. Silungise incazelo ka-{ref}.',
  ),
  'sum.ok': d('Thanks.', 'Tatenda.', 'Siyabonga.'),

  // ------------------------------------------------------------------ client replies
  'cc.thanks_yes': d(
    'Thank you. The job is confirmed. You can rate the work here: {link}',
    'Tatenda. Basa rasimbiswa. Munogona kupa mamaki pano: {link}',
    'Siyabonga. Umsebenzi uqinisekisiwe. Unganika amamaki lapha: {link}',
  ),
  'cc.thanks_no': d(
    'Thank you for telling us. We will look into this job.',
    'Tatenda nekutiudza. Tichaongorora basa iri.',
    'Siyabonga ngokusitshela. Sizawuhlola lumsebenzi.',
  ),
  'cc.stopped': d(
    'Done. You will not receive more messages from Skills Passport.',
    'Zvaitwa. Hamuchazowani mamwe mameseji kubva kuSkills Passport.',
    'Kwenziwe. Kawusayikuthola eminye imilayezo evela ku-Skills Passport.',
  ),
  'cc.already': d(
    'This job has already been answered. Thank you.',
    'Basa iri rakapindurwa kare. Tatenda.',
    'Lumsebenzi sewuphendulwe. Siyabonga.',
  ),
  'cc.expired': d(
    'This confirmation request has expired.',
    'Chikumbiro ichi chapera nguva.',
    'Lesi sicelo sesiphelelwe yisikhathi.',
  ),
  'cc.not_client': d(
    'Skills Passport turns artisans’ real work into a verified record. Send *hi* to create your own passport.',
    'Skills Passport inoshandura basa chairo remhizha kuita rekodhi yakasimbiswa. Tumira *hi* kuti uvhure passport yako.',
    'I-Skills Passport iguqula umsebenzi weqiniso wengcitshi ube yirekhodi eqinisekisiweyo. Thumela *hi* ukuze uvule eyakho.',
  ),

  // ------------------------------------------------------------------ artisan notifications
  'notify.confirmed': d(
    'Good news: {client} confirmed job *{ref}*.',
    'Nhau dzakanaka: {client} vasimbisa basa *{ref}*.',
    'Izindaba ezinhle: u-{client} uqinisekise umsebenzi *{ref}*.',
  ),
  'notify.rated': d(
    '{client} rated job *{ref}* {rating} out of 5.',
    '{client} vapa basa *{ref}* mamaki {rating} pa5.',
    'U-{client} unike umsebenzi *{ref}* amamaki angu-{rating} kwangu-5.',
  ),
  'notify.disputed': d(
    '{client} said job *{ref}* was not done. A verifier will look at it. If this is a mistake, send *help*.',
    '{client} vati basa *{ref}* harina kuitwa. Muongorori acharitarisa. Kana kuri kukanganisa, tumira *help*.',
    'U-{client} uthe umsebenzi *{ref}* kawenziwanga. Umhloli uzawuhlola. Nxa kuyiphutha, thumela *help*.',
  ),
  'notify.expired': d(
    "{client} didn't answer about job *{ref}* within 7 days. A field agent may call them.",
    '{client} havana kupindura nezvebasa *{ref}* mukati memazuva 7. Mumiriri angavafonera.',
    'U-{client} kaphendulanga ngomsebenzi *{ref}* phakathi kwensuku ezi-7. Umsebenzi wasendaweni angamfonela.',
  ),
  'notify.undeliverable': d(
    "We couldn't reach {client} on WhatsApp for job *{ref}*. A field agent will try to call them.",
    'Hatina kukwanisa kusvika ku{client} paWhatsApp nezvebasa *{ref}*. Mumiriri achaedza kuvafonera.',
    'Asikwazanga ukufinyelela u-{client} ku-WhatsApp ngomsebenzi *{ref}*. Umsebenzi wasendaweni uzazama ukumfonela.',
  ),
  'notify.client_opted_out': d(
    "{client} has stopped messages from Skills Passport, so we can't ask them about job *{ref}*. A field agent will follow up.",
    '{client} vakamisa mameseji eSkills Passport, saka hatigoni kuvabvunza nezvebasa *{ref}*. Mumiriri achatevera.',
    'U-{client} uvimbele imilayezo ye-Skills Passport, ngakho kasingeke simbuze ngomsebenzi *{ref}*. Umsebenzi wasendaweni uzalandela.',
  ),
  'notify.level_up': d(
    'Congratulations. You are now *{level}*.',
    'Makorokoto. Iye zvino muri *{level}*.',
    'Siyakuhalalisela. Khathesi useyi-*{level}*.',
  ),
  'notify.level_down': d(
    'Your level changed to *{level}*. Reason: {reason}',
    'Chikamu chenyu chachinja kuita *{level}*. Chikonzero: {reason}',
    'Isigaba sakho siguquke saba yi-*{level}*. Isizatho: {reason}',
  ),
  'notify.level_down_reason': d(
    'some jobs or endorsements no longer count.',
    'mamwe mabasa kana kutsigirwa hazvichaverengwi.',
    'eminye imisebenzi kumbe ukusekelwa sekungasabalwa.',
  ),
  'notify.review.meets': d(
    'A master artisan reviewed job *{ref}*: meets the standard.',
    'Mhizha huru yaongorora basa *{ref}*: rakasvika pamwero.',
    'Ingcitshi enkulu ihlole umsebenzi *{ref}*: ufinyelela izinga.',
  ),
  'notify.review.needs_improvement': d(
    'A master artisan reviewed job *{ref}*: needs improvement.',
    'Mhizha huru yaongorora basa *{ref}*: rinoda kuvandudzwa.',
    'Ingcitshi enkulu ihlole umsebenzi *{ref}*: udinga ukuthuthukiswa.',
  ),
  'notify.review.reject': d(
    'A master artisan reviewed job *{ref}*: not accepted.',
    'Mhizha huru yaongorora basa *{ref}*: harina kugamuchirwa.',
    'Ingcitshi enkulu ihlole umsebenzi *{ref}*: kawamukelwanga.',
  ),
  'notify.review_note': d('Note from the reviewer: {note}', 'Meseji kubva kumuongorori: {note}', 'Umlayezo ovela kumhloli: {note}'),
  'notify.endorsed': d(
    '{verifier} has endorsed you as a {trade} artisan. This is shown on your passport.',
    '{verifier} vakutsigira semhizha ye{trade}. Izvi zvinoratidzwa papassport yenyu.',
    'U-{verifier} ukusekele njengengcitshi ye-{trade}. Lokhu kukhonjiswa ku-passport yakho.',
  ),
  'notify.endorsement_withdrawn': d(
    'An endorsement on your passport was withdrawn.',
    'Kutsigirwa kumwe papassport yenyu kwabviswa.',
    'Ukusekelwa okukodwa ku-passport yakho kususiwe.',
  ),
  'notify.demo_requested': d(
    'A master artisan would like to see a practical demonstration for job *{ref}*. A field agent will contact you to arrange it.',
    'Mhizha huru inoda kuona muenzaniso webasa *{ref}*. Mumiriri achakuonai kuti murongerane.',
    'Ingcitshi enkulu ifuna ukubona umboniso womsebenzi *{ref}*. Umsebenzi wasendaweni uzakuthinta ukuze lihlele.',
  ),
  'notify.frozen': d(
    'Your level is on hold while our team checks some recent jobs. A field agent may contact you.',
    'Chikamu chenyu chamiswa apo timu yedu ichiongorora mamwe mabasa. Mumiriri angakuonai.',
    'Isigaba sakho simisiwe ngesikhathi iqembu lethu lihlola eminye imisebenzi. Umsebenzi wasendaweni angakuthinta.',
  ),

  // next-level nudges (SPEC 8)
  'nudge.jobs': d(
    '{n} more confirmed jobs to reach {level}.',
    'Mamwe mabasa {n} akasimbiswa kuti usvike pa{level}.',
    'Eminye imisebenzi engu-{n} eqinisekisiweyo ukuze ufike ku-{level}.',
  ),
  'nudge.jobs_one': d(
    '1 more confirmed job to reach {level}.',
    'Rimwe basa 1 rakasimbiswa kuti usvike pa{level}.',
    'Omunye umsebenzi o-1 oqinisekisiweyo ukuze ufike ku-{level}.',
  ),
  'nudge.clients': d(
    '{n} more jobs from new clients to reach {level}.',
    'Mamwe mabasa {n} kubva kuvatengi vatsva kuti usvike pa{level}.',
    'Eminye imisebenzi engu-{n} evela kubathengi abatsha ukuze ufike ku-{level}.',
  ),
  'nudge.clients_one': d(
    '1 more job from a new client to reach {level}.',
    'Rimwe basa 1 kubva kumutengi mutsva kuti usvike pa{level}.',
    'Omunye umsebenzi o-1 ovela kumthengi omutsha ukuze ufike ku-{level}.',
  ),
  'nudge.other': d(
    'Next level: {level}. Send *menu* and choose My passport to see what is left.',
    'Chikamu chinotevera: {level}. Tumira *menu* usarudze Passport yangu kuti uone zvasara.',
    'Isigaba esilandelayo: {level}. Thumela *menu* ukhethe I-passport yami ukuze ubone okusele.',
  ),

  // ------------------------------------------------------------------ my passport
  'passport.status': d(
    '*Your Skills Passport*\n{code} · {level}\n\nConfirmed jobs: {jobs}\nClients served: {clients}\nAverage rating: {rating}\n\n{next}\n\nYour page: {link}',
    '*Skills Passport yenyu*\n{code} · {level}\n\nMabasa akasimbiswa: {jobs}\nVatengi: {clients}\nAvhareji yemamaki: {rating}\n\n{next}\n\nPeji renyu: {link}',
    '*I-Skills Passport yakho*\n{code} · {level}\n\nImisebenzi eqinisekisiweyo: {jobs}\nAbathengi: {clients}\nIsilinganiso samamaki: {rating}\n\n{next}\n\nIkhasi lakho: {link}',
  ),
  'passport.next_header': d('To reach *{level}*:', 'Kuti usvike pa*{level}*:', 'Ukuze ufike ku-*{level}*:'),
  'passport.at_gold': d(
    'You are at Gold, the highest level. Keep logging jobs to keep your passport current.',
    'Muri paGold, chikamu chepamusoro. Rambai muchinyora mabasa kuti passport irambe ichiratidza zvazvino.',
    'Useku-Gold, isigaba esiphezulu. Qhubeka ubhala imisebenzi ukuze i-passport ihlale imutsha.',
  ),
  'passport.frozen': d(
    'Your level is on hold while our team checks recent jobs.',
    'Chikamu chenyu chakamiswa apo timu ichiongorora mabasa.',
    'Isigaba sakho simisiwe ngesikhathi iqembu lihlola imisebenzi.',
  ),
  'passport.no_rating': d('no ratings yet', 'hapana mamaki parizvino', 'akukho amamaki okwamanje'),
  'check.met': d('✓', '✓', '✓'),
  'check.todo': d('·', '·', '·'),
  'check.jobs': d('Confirmed jobs: {have} of {need}', 'Mabasa akasimbiswa: {have} pa{need}', 'Imisebenzi eqinisekisiweyo: {have} kwangu-{need}'),
  'check.clients': d('Different clients: {have} of {need}', 'Vatengi vakasiyana: {have} pa{need}', 'Abathengi abehlukeneyo: {have} kwangu-{need}'),
  'check.endorsements': d('Endorsements: {have} of {need}', 'Kutsigirwa: {have} pa{need}', 'Ukusekelwa: {have} kwangu-{need}'),
  'check.endorsing_verifiers': d(
    'Endorsements from different master artisans: {have} of {need}',
    'Kutsigirwa nemhizha huru dzakasiyana: {have} pa{need}',
    'Ukusekelwa yizingcitshi ezinkulu ezehlukeneyo: {have} kwangu-{need}',
  ),
  'check.rating': d('Average rating: {have} (need {need})', 'Avhareji yemamaki: {have} (zvinodiwa {need})', 'Isilinganiso samamaki: {have} (kudingeka {need})'),
  'check.ratings_count': d('Client ratings: {have} of {need}', 'Mamaki evatengi: {have} pa{need}', 'Amamaki abathengi: {have} kwangu-{need}'),
  'check.no_open_disputes': d('No open disputes ({have} open)', 'Hapana kupokana kwakavhurika ({have})', 'Akukho ukuphikisana okuvulekileyo ({have})'),
  'check.meets_reviews': d(
    'Jobs reviewed as meeting the standard: {have} of {need}',
    'Mabasa akaongororwa akasvika pamwero: {have} pa{need}',
    'Imisebenzi ehloliweyo efinyelela izinga: {have} kwangu-{need}',
  ),
  'check.span_days': d('Days of work history: {have} of {need}', 'Mazuva ebasa: {have} pa{need}', 'Insuku zomlando womsebenzi: {have} kwangu-{need}'),
  'check.verified_units': d('Skills verified: {have}% of {need}%', 'Hunyanzvi hwakasimbiswa: {have}% pa{need}%', 'Amakhono aqinisekisiweyo: {have}% kwangu-{need}%'),

  // ------------------------------------------------------------------ waiting for clients
  'waiting.none': d(
    'No jobs are waiting for clients right now.',
    'Hapana basa rakamirira vatengi parizvino.',
    'Akukho msebenzi olindele abathengi okwamanje.',
  ),
  'waiting.list': d('Jobs waiting for client confirmation:', 'Mabasa akamirira kusimbiswa:', 'Imisebenzi elindele ukuqinisekiswa:'),
  'waiting.item': d(
    'Job *{ref}* ({jobType}) for {client}, sent {date}. Reminders sent: {reminders}.',
    'Basa *{ref}* ({jobType}) ra{client}, rakatumirwa {date}. Zviyeuchidzo: {reminders}.',
    'Umsebenzi *{ref}* ({jobType}) ka-{client}, uthunyelwe ngo-{date}. Izikhumbuzo: {reminders}.',
  ),
  'waiting.btn.remind': d('Send reminder', 'Tumira chiyeuchidzo', 'Thumela isikhumbuzo'),
  'waiting.btn.change': d('Change number', 'Chinja nhamba', 'Guqula inombolo'),
  'waiting.reminded': d('Reminder sent to {client}.', 'Chiyeuchidzo chatumirwa ku{client}.', 'Isikhumbuzo sithunyelwe ku-{client}.'),
  'waiting.remind_limit': d(
    'We have already sent the most reminders allowed for this job.',
    'Tatotumira zviyeuchidzo zvese zvinobvumirwa pabasa iri.',
    'Sesithumele zonke izikhumbuzo ezivunyelweyo kulumsebenzi.',
  ),
  'waiting.change_prompt': d("Send the client's correct phone number.", 'Tumira nhamba chaiyo yemutengi.', 'Thumela inombolo eqondileyo yomthengi.'),
  'waiting.changed': d(
    'Updated. We sent the confirmation request to the new number.',
    'Zvagadziriswa. Tatumira chikumbiro kunhamba itsva.',
    'Kulungisiwe. Sithumele isicelo enombolweni entsha.',
  ),

  // ------------------------------------------------------------------ share
  'share.intro': d(
    'Forward the next message to clients, or post the card on your WhatsApp Status.',
    'Endesa meseji inotevera kuvatengi, kana isa kadhi paWhatsApp Status yako.',
    'Dlulisela umlayezo olandelayo kubathengi, kumbe ufake ikhadi ku-WhatsApp Status yakho.',
  ),
  'share.text': d(
    'My Skills Passport: {name}, {trade}, level {level}. Confirmed by real clients: {link}',
    'Skills Passport yangu: {name}, {trade}, chikamu {level}. Yakasimbiswa nevatengi chaivo: {link}',
    'I-Skills Passport yami: {name}, {trade}, isigaba {level}. Iqinisekiswe ngabathengi beqiniso: {link}',
  ),
  'share.qr_caption': d(
    'QR code for {code}. Print it or show it to clients.',
    'QR code ye{code}. Iprinte kana uiratidze vatengi.',
    'I-QR code ka-{code}. Yiphrinte kumbe uyitshengise abathengi.',
  ),
  'share.card_caption': d('Post this on your WhatsApp Status.', 'Isa izvi paWhatsApp Status yako.', 'Faka lokhu ku-WhatsApp Status yakho.'),

  // ------------------------------------------------------------------ work requests
  'wr.none': d('You have no open work requests.', 'Hapana zvikumbiro zvebasa zvakavhurika.', 'Akulazicelo zomsebenzi ezivulekileyo.'),
  'wr.list': d('Open work requests:', 'Zvikumbiro zvebasa zvakavhurika:', 'Izicelo zomsebenzi ezivulekileyo:'),
  'wr.detail': d(
    'Work request from *{buyer}*\nArea: {area}\nWhen: {dates}\n\n{description}',
    'Chikumbiro chebasa kubva ku*{buyer}*\nNzvimbo: {area}\nRiini: {dates}\n\n{description}',
    'Isicelo somsebenzi esivela ku-*{buyer}*\nIndawo: {area}\nNini: {dates}\n\n{description}',
  ),
  'wr.accepted': d(
    'You accepted. Contact {contact} at {phone}. They now have your number too.',
    'Mabvuma. Bata {contact} pa{phone}. Vava nenhamba yenyu futi.',
    'Wamukele. Thinta u-{contact} ku-{phone}. Labo sebelayo inombolo yakho.',
  ),
  'wr.declined': d('You declined the request.', 'Maramba chikumbiro.', 'Usalile isicelo.'),
  'wr.closed': d('This request is no longer open.', 'Chikumbiro ichi hachisisina kuvhurika.', 'Lesi sicelo kasisavulekanga.'),
  'hire.ask_log': d(
    'Great. Log it as a confirmed job with {buyer} as the client?',
    'Zvakanaka. Rinyore sebasa rakasimbiswa, {buyer} ari mutengi here?',
    'Kuhle. Uwubhale njengomsebenzi oqinisekisiweyo, u-{buyer} engumthengi yini?',
  ),
  'hire.btn.log': d('Log the job', 'Nyora basa', 'Bhala umsebenzi'),
  'hire.thanks': d('Thanks for letting us know.', 'Tatenda nekutizivisa.', 'Siyabonga ngokusazisa.'),

  // ------------------------------------------------------------------ help
  'help.body': d('How can we help?', 'Tingakubatsirai sei?', 'Singakunceda njani?'),
  'help.faq': d('How it works', 'Kushanda kwazvo', 'Ukusebenza kwakho'),
  'help.agent': d('Talk to a field agent', 'Taura nemumiriri', 'Khuluma lomsebenzi wasendaweni'),
  'help.report': d('Report a client', 'Mhan’ara mutengi', 'Bika umthengi'),
  'help.faq_text': d(
    '*How Skills Passport works*\n1. After a job, log it here with photos and a voice note.\n2. Your client confirms with one tap.\n3. A master artisan checks some of your jobs.\n4. Your level rises as confirmed jobs, clients and endorsements grow.\n\nYour passport is a record of real work. It is not an official trade-test certificate.',
    '*Kushanda kweSkills Passport*\n1. Mushure mebasa, rinyore pano nemifananidzo nevoice note.\n2. Mutengi anosimbisa nekudzvanya kamwe.\n3. Mhizha huru inoongorora mamwe mabasa.\n4. Chikamu chenyu chinokwira mabasa, vatengi nekutsigirwa zvichiwedzera.\n\nPassport yenyu irekodhi yebasa chairo. Haisi setifiketi yepamutemo ye trade test.',
    '*Indlela i-Skills Passport esebenza ngayo*\n1. Ngemva komsebenzi, wubhale lapha ngemifanekiso le-voice note.\n2. Umthengi wakho uqinisekisa ngokucindezela kanye.\n3. Ingcitshi enkulu ihlola eminye imisebenzi.\n4. Isigaba sakho siyakhuphuka njengoba imisebenzi, abathengi lokusekelwa kukhula.\n\nI-passport yakho yirekhodi yomsebenzi weqiniso. Kayisiso isitifiketi esisemthethweni se-trade test.',
  ),
  'help.agent_text': d(
    'A field agent will contact you within 2 working days.',
    'Mumiriri achakuonai mukati memazuva 2 ekushanda.',
    'Umsebenzi wasendaweni uzakuthinta phakathi kwensuku ezi-2 zokusebenza.',
  ),
  'help.report_pick': d('Which client do you want to report?', 'Ndeupi mutengi waunoda kumhan’ara?', 'Ngubani umthengi ofuna ukumbika?'),
  'help.report_none': d('You have no clients to report.', 'Hauna vatengi vekumhan’ara.', 'Kawulabo abathengi ongababika.'),
  'help.report_reason': d('Why are you reporting this client?', 'Sei uchimhan’ara mutengi uyu?', 'Kungani ubika lumthengi?'),
  'report.unsafe': d('Unsafe or threatening', 'Njodzi kana kutyisidzira', 'Ingozi kumbe ukwesabisa'),
  'report.harassment': d('Harassment', 'Kushungurudzwa', 'Ukuhlukunyezwa'),
  'report.nonpayment': d('Did not pay', 'Haana kubhadhara', 'Kabhadalanga'),
  'report.other': d('Other', 'Zvimwe', 'Okunye'),
  'help.reported': d(
    'Thank you. Your report is recorded and this client can no longer send you work through Skills Passport. If you are in danger, call the police on 995.',
    'Tatenda. Kumhan’ara kwenyu kwanyorwa uye mutengi uyu haachakwanisi kukutumira basa kuburikidza neSkills Passport. Kana muri munjodzi, fonai mapurisa pa995.',
    'Siyabonga. Umbiko wakho ubhaliwe njalo lumthengi kasakwazi ukukuthumela umsebenzi nge-Skills Passport. Nxa usengozini, fonela amapholisa ku-995.',
  ),

  // ------------------------------------------------------------------ settings
  'settings.body': d('Settings', 'Zvirongwa', 'Izilungiselelo'),
  'settings.language': d('Language', 'Mutauro', 'Ulimi'),
  'settings.show_full': d('Show my full name', 'Ratidza zita rangu rese', 'Khombisa ibizo lami lonke'),
  'settings.show_short': d('Show first name only', 'Ratidza zita rekutanga chete', 'Khombisa ibizo lokuqala kuphela'),
  'settings.delete': d('Delete my account', 'Dzima account yangu', 'Cima i-akhawunti yami'),
  'settings.language_set': d('Language changed.', 'Mutauro wachinjwa.', 'Ulimi luguquliwe.'),
  'settings.name_full': d('Your passport now shows your full name.', 'Passport yenyu yava kuratidza zita renyu rese.', 'I-passport yakho isikhombisa ibizo lakho lonke.'),
  'settings.name_short': d(
    'Your passport now shows your first name and surname initial.',
    'Passport yenyu yava kuratidza zita rekutanga nevara rekutanga remusoro.',
    'I-passport yakho isikhombisa ibizo lokuqala lohlamvu lokuqala lwesibongo.',
  ),
  'settings.delete_confirm': d(
    "Delete your account? Your public page goes offline now and your personal data is deleted within 30 days. This can't be undone.",
    'Dzima account yenyu here? Peji renyu rinobviswa izvozvi uye ruzivo rwenyu runodzimwa mukati memazuva 30. Hazvigoni kudzoserwa.',
    'Ucime i-akhawunti yakho yini? Ikhasi lakho lisuswa khathesi njalo ulwazi lwakho lucinywa phakathi kwensuku ezingu-30. Lokhu akubuyiseki.',
  ),
  'settings.btn.delete': d('Delete', 'Dzima', 'Cima'),
  'settings.deleted': d(
    'Your account is deleted and your page is offline. Thank you for using Skills Passport.',
    'Account yenyu yadzimwa uye peji renyu rabviswa. Tatenda nekushandisa Skills Passport.',
    'I-akhawunti yakho icinyiwe njalo ikhasi lakho lisusiwe. Siyabonga ngokusebenzisa i-Skills Passport.',
  ),

  // ------------------------------------------------------------------ agent-assisted ownership
  'own.confirmed': d(
    "Thanks. We'll ask the client to confirm job *{ref}*.",
    'Tatenda. Tichabvunza mutengi kuti asimbise basa *{ref}*.',
    'Siyabonga. Sizacela umthengi ukuthi aqinisekise umsebenzi *{ref}*.',
  ),
  'own.denied': d(
    "Thanks for telling us. We've stopped job *{ref}* and our team will check it.",
    'Tatenda nekutiudza. Tamisa basa *{ref}* uye timu yedu icharitarisa.',
    'Siyabonga ngokusitshela. Simise umsebenzi *{ref}* njalo iqembu lethu lizawuhlola.',
  ),

  // ------------------------------------------------------------------ WhatsApp templates (bodies use {1}… like Meta)
  'tpl.client_confirmation': d(
    "Skills Passport: {1} says they did '{2}' for you on {3}. Was this work done?\nRate the work and see photos: {4}\nReply with a button below.",
    "Skills Passport: {1} vanoti vakakuitirai '{2}' musi wa{3}. Basa iri rakaitwa here?\nPai mamaki uye muone mifananidzo: {4}\nPindurai nebhatani riri pazasi.",
    "Skills Passport: u-{1} uthi ukwenzele '{2}' ngo-{3}. Umsebenzi lo wenziwe yini?\nNika amamaki ubone imifanekiso: {4}\nPhendula ngenkinobho engezansi.",
  ),
  'tpl.client_reminder': d(
    "Reminder from Skills Passport: {1} says they did '{2}' for you on {3}. Was this work done?\nRate the work: {4}\nReply with a button below.",
    "Chiyeuchidzo kubva kuSkills Passport: {1} vanoti vakakuitirai '{2}' musi wa{3}. Basa iri rakaitwa here?\nPai mamaki: {4}\nPindurai nebhatani riri pazasi.",
    "Isikhumbuzo esivela ku-Skills Passport: u-{1} uthi ukwenzele '{2}' ngo-{3}. Umsebenzi lo wenziwe yini?\nNika amamaki: {4}\nPhendula ngenkinobho engezansi.",
  ),
  'tpl.artisan_job_update': d('Skills Passport: update on job {1}. {2}\nTap below to open your passport.', 'Skills Passport: nhau dzebasa {1}. {2}\nDzvanyai pazasi kuti muone passport yenu.', 'Skills Passport: okutsha ngomsebenzi {1}. {2}\nThinta ngezansi ukuze ubone i-passport yakho.'),
  'tpl.artisan_review_result': d('Skills Passport: job {1} was reviewed. {2}\nTap below to open your passport.', 'Skills Passport: basa {1} raongororwa. {2}\nDzvanyai pazasi kuti muone passport yenu.', 'Skills Passport: umsebenzi {1} uhloliwe. {2}\nThinta ngezansi ukuze ubone i-passport yakho.'),
  'tpl.artisan_work_request': d(
    'Skills Passport: new work request from {1} in {2}: {3}\nReply with a button below.',
    'Skills Passport: chikumbiro chitsva chebasa kubva ku{1} mu{2}: {3}\nPindurai nebhatani riri pazasi.',
    'Skills Passport: isicelo esitsha somsebenzi esivela ku-{1} e-{2}: {3}\nPhendula ngenkinobho engezansi.',
  ),
  'tpl.artisan_job_ownership': d(
    "Skills Passport: field agent {1} logged a '{2}' job for you ({3}). Is this your job?",
    "Skills Passport: mumiriri {1} anyora basa re'{2}' renyu ({3}). Iri ibasa renyu here?",
    "Skills Passport: umsebenzi wasendaweni u-{1} ubhalele wena umsebenzi we-'{2}' ({3}). Ngowakho yini?",
  ),
  'tpl.hire_follow_up': d(
    'Skills Passport: did the job with {1} happen? ({2})',
    'Skills Passport: basa na{1} rakaitika here? ({2})',
    'Skills Passport: umsebenzi lo-{1} wenzekile yini? ({2})',
  ),
  'tpl.btn.yes_done': d('Yes, it was done', 'Hongu, rakaitwa', 'Yebo, wenziwe'),
  'tpl.btn.no': d('No', 'Kwete', 'Hatshi'),
  'tpl.btn.stop': d('Stop messages', 'Misa mameseji', 'Misa imilayezo'),
  'tpl.btn.my_passport': d('My passport', 'Passport yangu', 'I-passport yami'),
  'tpl.btn.accept': d('Accept', 'Bvuma', 'Vuma'),
  'tpl.btn.decline': d('Decline', 'Ramba', 'Ala'),
  'tpl.btn.yes_mine': d("Yes, it's mine", 'Hongu, nderangu', 'Yebo, ngowami'),
  'tpl.btn.not_mine': d('Not mine', 'Harisi rangu', 'Akusiwo owami'),
  'tpl.btn.job_happened': d('Yes, it happened', 'Hongu, rakaitika', 'Yebo, wenzekile'),
  'tpl.btn.job_not_happened': d("No, it didn't", 'Kwete', 'Hatshi'),
} satisfies Record<string, Entry>;

export type MessageKey = keyof typeof catalogue;
