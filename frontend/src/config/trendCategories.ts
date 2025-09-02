export interface TrendCategory {
  id: string;
  name: string;
  icon: string;
  hashtags: string[];
}

export const trendCategories: TrendCategory[] = [
  { id: 'tech', name: 'Tech', icon: '🖥️', hashtags: ['#tech', '#programming', '#ai', '#startup', '#coding', '#developer', '#software', '#blockchain', '#cryptocurrency', '#innovation', '#data', '#cybersecurity', '#machine learning', '#cloud', '#javascript', '#python', '#react', '#nodejs', '#github', '#opensource'] },
  { id: 'sport', name: 'Sports', icon: '⚽', hashtags: ['#football', '#basketball', '#sport', '#uefa', '#nfl', '#nba', '#soccer', '#tennis', '#olympics', '#fitness', '#workout', '#baseball', '#hockey', '#athletics', '#swimming', '#cycling', '#running', '#volleyball', '#golf', '#boxing'] },
  { id: 'music', name: 'Music', icon: '🎵', hashtags: ['#music', '#concert', '#album', '#spotify', '#hiphop', '#rock', '#pop', '#jazz', '#classical', '#country', '#electronic', '#indie', '#metal', '#blues', '#reggae', '#punk', '#folk', '#rnb', '#trap', '#techno'] },
  { id: 'movies', name: 'Movies', icon: '🎬', hashtags: ['#movie', '#cinema', '#netflix', '#film', '#hollywood', '#actor', '#actress', '#director', '#oscar', '#marvel', '#disney', '#horror', '#comedy', '#drama', '#thriller', '#scifi', '#action', '#romance', '#documentary', '#animation'] },
  { id: 'news', name: 'News', icon: '🗞️', hashtags: ['#news', '#breaking', '#politics', '#world', '#economy', '#business', '#finance', '#election', '#government', '#international', '#local', '#weather', '#breaking', '#media', '#journalism', '#current events', '#society', '#culture', '#security', '#law'] },
  { id: 'gaming', name: 'Gaming', icon: '🎮', hashtags: ['#gaming', '#ps5', '#xbox', '#steam', '#nintendo', '#esports', '#twitch', '#minecraft', '#fortnite', '#cod', '#valorant', '#apex', '#mobile', '#pc gaming', '#indie games', '#retro', '#mmorpg', '#fps', '#rpg', '#strategy'] },
  { id: 'food', name: 'Food', icon: '🍕', hashtags: ['#food', '#cooking', '#recipe', '#restaurant', '#pizza', '#burger', '#vegan', '#healthy', '#dessert', '#wine', '#coffee', '#breakfast', '#dinner', '#baking', '#chef', '#foodie', '#italian', '#asian', '#mexican', '#seafood'] },
  { id: 'travel', name: 'Travel', icon: '✈️', hashtags: ['#travel', '#vacation', '#adventure', '#explore', '#wanderlust', '#photography', '#nature', '#beach', '#mountains', '#europe', '#asia', '#america', '#backpacking', '#roadtrip', '#citybreak', '#culture', '#heritage', '#tropical', '#skiing', '#safari'] },
  { id: 'fashion', name: 'Fashion', icon: '👗', hashtags: ['#fashion', '#style', '#outfit', '#model', '#designer', '#luxury', '#streetstyle', '#beauty', '#makeup', '#skincare', '#brand', '#vintage', '#trend', '#accessories', '#shoes', '#handbags', '#jewelry', '#sustainable', '#couture', '#runway'] },
  { id: 'health', name: 'Health', icon: '🏥', hashtags: ['#health', '#fitness', '#wellness', '#medical', '#nutrition', '#yoga', '#gym', '#mental', '#healthcare', '#covid', '#vaccine', '#medicine', '#therapy', '#meditation', '#diet', '#exercise', '#doctor', '#nursing', '#prevention', '#recovery'] },
  { id: 'education', name: 'Education', icon: '📚', hashtags: ['#education', '#learning', '#school', '#university', '#student', '#teacher', '#knowledge', '#study', '#research', '#science', '#books', '#online', '#elearning', '#classroom', '#homework', '#exam', '#graduation', '#scholarship', '#academy', '#curriculum'] },
  { id: 'art', name: 'Art', icon: '🎨', hashtags: ['#art', '#artist', '#painting', '#drawing', '#creative', '#design', '#photography', '#sculpture', '#gallery', '#exhibition', '#digital', '#street', '#contemporary', '#abstract', '#portrait', '#landscape', '#illustration', '#graffiti', '#ceramics', '#printmaking'] },
  { id: 'environment', name: 'Environment', icon: '🌱', hashtags: ['#environment', '#climate', '#green', '#sustainability', '#nature', '#ecology', '#renewable', '#conservation', '#pollution', '#earth', '#eco', '#wildlife', '#recycling', '#solar', '#biodiversity', '#ocean', '#forest', '#carbon', '#organic', '#planet'] },
  { id: 'photography', name: 'Photography', icon: '📸', hashtags: ['#photography', '#photo', '#camera', '#portrait', '#landscape', '#street', '#nature', '#wedding', '#canon', '#nikon', '#sony', '#editing', '#photoshoot', '#macro', '#wildlife', '#travel', '#fashion', '#black and white', '#vintage', '#digital'] },
  { id: 'business', name: 'Business', icon: '💼', hashtags: ['#business', '#entrepreneur', '#marketing', '#sales', '#leadership', '#management', '#startup', '#investment', '#finance', '#economy', '#strategy', '#growth', '#success', '#innovation', '#networking', '#branding', '#ecommerce', '#productivity', '#teamwork', '#corporate'] },
];
