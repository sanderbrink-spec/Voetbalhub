'use strict';
/**
 * Veldio editorial illustration policy.
 * A category supplies symbolic imagery only. It must never invent people,
 * a transfer signing, a medical event, a match result or a real photograph.
 */
const SCENES=Object.freeze({
 stadium:'empty realistic stadium seating and field at a believable time of day',
 supporters:'two unbranded club-coloured scarves on empty stadium seats, no recreated supporter incident',
 boardroom:'empty realistic stadium meeting room and folders without any names or printed decisions',
 finance:'unbranded closed accounts folder, calculator with no readable figures, stadium in distance',
 training:'empty training ground with cones, training balls and an unbranded gear bag',
 injury:'empty touchline medical kit and unused athletic tape near a football, no injured person or treatment',
 coach:'empty coaching area with whistle, folded jacket and tactics board, no fictional trainer portrait',
 tactics:'tactical board with abstract positions, magnets and ball, no unverified line-up or numbers',
 youth:'empty academy training pitch with cones and small training balls, no children or identifiable faces',
 suspension:'empty dressing room bench with disciplinary paperwork face-down, no invented red-card incident',
 interview:'empty press-conference microphone and chairs with blank backdrop, no fake quotation',
 competition:'football trophy silhouette in a fictional neutral presentation space, no official competition trophy or logo',
 history:'aged football boots, archival-inspired but clearly fictional empty pitch, no imitation archival photograph'
});
const DETECTION=Object.freeze([
 ['injury',/\b(blessur\w*|geblesseerd|revalid\w*|hersteltijd|operatie)\b/],
 ['suspension',/\b(schors\w*|geschorst|rode kaart)\b/],
 ['coach',/\b(trainer\w*|hoofdcoach|oefenmeester|technisch directeur|ontslag)\b/],
 ['tactics',/\b(tactiek|formatie|speelwijze|opstelling|pressing|veldbezetting|analyse)\b/],
 ['youth',/\b(jeugd\w*|academie|talent\w*|onder 21|onder 19)\b/],
 ['interview',/\b(interview|persconferentie|verklaart|toelichting)\b/],
 ['competition',/\b(kampioen\w*|bekerfinale|loting|competitiestart|promotie|degradatie)\b/],
 ['history',/\b(historie|historisch|jubileum|herdenking)\b/]
]);
function detect(lead){return DETECTION.find(([name,re])=>re.test(String(lead||'')))?.[0]||null;}
function visual(scene){return SCENES[scene]||SCENES.stadium;}
function rules(scene){return {
 subject:scene, originalOnly:true, aiDisclosure:true, documentaryClaim:false,
 clubLogo:false, officialCompetitionLogo:false, knownPlayerPortrait:false,
 fabricatedQuotes:false, fabricatedEvents:false, inventedScore:false,
 fakeTransferSigning:false, depictedUnverifiedInjury:false,
 requiredVisual:visual(scene), watermark:'Original Veldio logo applied after review only'
};}
module.exports={SCENES,detect,visual,rules};
