import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { getAlbumById, getAlbums, removeAlbum, saveAlbum, updateAlbum } from './services/albumStorage';
import { getCommentsByReview, removeComment, saveComment } from './services/commentStorage';
import { musicSearch } from './services/musicSearch';
import { getTrendingAlbums } from './services/trendingAlbums';
import { getReviewsByAlbum, saveReview, toggleLike, updateReview } from './services/reviewStorage';
import { getCurrentUser, saveUser, updateUser } from './services/userStorage';

const palette = {
  background: '#0A0A0A',
  title: '#2D3640',
  accent: '#00FF66',
  text: '#7A848C',
  border: '#2A2F33',
  surface: '#1C2422',
};

const tabs = [
  { label: 'Início', key: 'home', mark: '01' },
  { label: 'Explorar', key: 'explore', mark: '02' },
  { label: 'Atividade', key: 'activity', mark: '03' },
  { label: 'Perfil', key: 'profile', mark: '04' },
];

function AlbumCover({ album, large = false }) {
  if (album.coverUrl) {
    return <Image source={{ uri: album.coverUrl }} style={[styles.albumCover, large && styles.largeCover]} />;
  }

  return <View style={[styles.albumCover, styles.coverPlaceholder, large && styles.largeCover]}><Text style={styles.coverPlaceholderText}>REPLAY</Text></View>;
}

function AlbumCard({ album, onPress, cardWidth }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.albumCard, { width: cardWidth }, pressed && styles.pressed]}><AlbumCover album={album} /><Text style={styles.albumTitle} numberOfLines={2}>{album.title}</Text><Text style={styles.albumArtist} numberOfLines={1}>{album.artist || 'Artista desconhecido'}</Text></Pressable>;
}

function SearchResult({ album, onAdd }) {
  return <Pressable onPress={onAdd} style={({ pressed }) => [styles.searchResult, pressed && styles.pressed]}><AlbumCover album={album} /><View style={styles.searchResultInfo}><Text style={styles.searchResultTitle} numberOfLines={2}>{album.title}</Text><Text style={styles.searchResultArtist} numberOfLines={1}>{album.artist || 'Artista desconhecido'}</Text></View><View style={styles.addSmallButton}><Text style={styles.addSmallButtonText}>+</Text></View></Pressable>;
}

function TrendingCard({ album, onAdd }) {
  return (
    <Pressable onPress={() => onAdd(album)} style={({ pressed }) => [styles.trendingCard, pressed && styles.pressed]}>
      {album.coverUrl ? (
        <Image source={{ uri: album.coverUrl }} style={styles.trendingCover} />
      ) : (
        <View style={[styles.trendingCover, styles.coverPlaceholder]}>
          <Text style={styles.coverPlaceholderText}>REPLAY</Text>
        </View>
      )}
      <Text style={styles.trendingTitle} numberOfLines={2}>{album.title}</Text>
      <Text style={styles.trendingArtist} numberOfLines={1}>{album.artist || 'Artista desconhecido'}</Text>
      <View style={styles.trendingAddButton}><Text style={{ color: palette.background, fontWeight: '900' }}>+</Text></View>
    </Pressable>
  );
}

async function pickImageAsBase64(onPicked, onError) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    onError('Permita o acesso as fotos para escolher uma imagem.');
    return false;
  }

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8, base64: true });

  if (result.canceled || !result.assets?.[0]?.base64) return false;

  const image = result.assets[0];
  onPicked(`data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`);
  return true;
}

function UserAvatar({ user, large = false }) {
  if (user.photoUrl) {
    return <Image source={{ uri: user.photoUrl }} style={[styles.userAvatar, large && styles.largeUserAvatar]} />;
  }

  return <View style={[styles.userAvatar, styles.avatarPlaceholder, large && styles.largeUserAvatar]}><Text style={[styles.avatarInitial, large && styles.largeAvatarInitial]}>{user.name?.charAt(0)?.toUpperCase() || 'R'}</Text></View>;
}

function ProfileForm({ initialUser = null, albums, onSaved }) {
  const isFirstAccess = !initialUser;
  const [name, setName] = useState(initialUser?.name || '');
  const [photoUrl, setPhotoUrl] = useState(initialUser?.photoUrl || null);
  const [bio, setBio] = useState(initialUser?.bio || '');
  const [artists, setArtists] = useState([...(initialUser?.topArtists || []), '', '', ''].slice(0, 3));
  const [topAlbumIds, setTopAlbumIds] = useState(initialUser?.topAlbumIds || []);
  const [errors, setErrors] = useState({});

  async function handlePickPhoto() {
    const picked = await pickImageAsBase64(setPhotoUrl, (message) => setErrors((currentErrors) => ({ ...currentErrors, photo: message })));
    if (picked) setErrors((currentErrors) => ({ ...currentErrors, photo: '' }));
  }

  function toggleAlbum(albumId) {
    setTopAlbumIds((currentIds) => currentIds.includes(albumId) ? currentIds.filter((id) => id !== albumId) : currentIds.length < 3 ? [...currentIds, albumId] : currentIds);
  }

  async function handleSubmit() {
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = 'Informe seu nome.';
    if (isFirstAccess && !photoUrl) nextErrors.photo = 'Escolha uma foto de perfil.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const user = {
      id: initialUser?.id || globalThis.crypto?.randomUUID?.() || `user-${Date.now()}`,
      name: name.trim(),
      photoUrl: photoUrl || '',
      bio: bio.trim(),
      topArtists: artists.map((artist) => artist.trim()).filter(Boolean).slice(0, 3),
      topAlbumIds: topAlbumIds.slice(0, 3),
      followerIds: initialUser?.followerIds || [],
      followingIds: initialUser?.followingIds || [],
    };

    try {
      const savedUser = initialUser ? await updateUser(user) : await saveUser(user);
      if (!savedUser) {
        setErrors({ submit: 'Nao foi possivel salvar o perfil. Tente novamente.' });
        return;
      }
      onSaved(savedUser);
    } catch {
      setErrors({ submit: 'Nao foi possivel salvar o perfil. Tente novamente.' });
    }
  }

  function updateArtist(index, value) {
    setArtists((currentArtists) => currentArtists.map((artist, artistIndex) => artistIndex === index ? value : artist));
  }

  return <ScrollView contentContainerStyle={styles.profileForm} keyboardShouldPersistTaps="handled"><Pressable onPress={handlePickPhoto} style={[styles.profilePhotoPicker, errors.photo && styles.inputError]}>{photoUrl ? <Image source={{ uri: photoUrl }} style={styles.selectedProfilePhoto} /> : <><Text style={styles.coverPickerPlus}>+</Text><Text style={styles.coverPickerText}>ESCOLHER FOTO</Text></>}</Pressable>{Boolean(errors.photo) && <Text style={styles.fieldError}>{errors.photo}</Text>}<Text style={styles.fieldLabel}>NOME *</Text><TextInput value={name} onChangeText={(value) => { setName(value); if (value.trim()) setErrors((currentErrors) => ({ ...currentErrors, name: '' })); }} placeholder="Seu nome" placeholderTextColor={palette.text} style={[styles.formInput, errors.name && styles.inputError]} />{Boolean(errors.name) && <Text style={styles.fieldError}>{errors.name}</Text>}<Text style={styles.fieldLabel}>BIOGRAFIA</Text><TextInput value={bio} onChangeText={setBio} placeholder="Fale um pouco sobre voce" placeholderTextColor={palette.text} style={[styles.formInput, styles.descriptionInput]} multiline textAlignVertical="top" /><Text style={styles.fieldLabel}>TOP 3 ARTISTAS</Text>{artists.map((artist, index) => <TextInput key={index} value={artist} onChangeText={(value) => updateArtist(index, value)} placeholder={`Artista ${index + 1}`} placeholderTextColor={palette.text} style={styles.formInput} />)}<Text style={styles.fieldLabel}>TOP 3 ALBUNS</Text><Text style={styles.selectionHint}>Escolha ate 3 albuns do seu catalogo.</Text><View style={styles.albumSelection}>{albums.length === 0 ? <Text style={styles.searchHint}>Adicione albuns ao catalogo para seleciona-los.</Text> : albums.map((album) => { const isSelected = topAlbumIds.includes(album.id); return <Pressable key={album.id} onPress={() => toggleAlbum(album.id)} style={[styles.albumOption, isSelected && styles.albumOptionSelected]}><AlbumCover album={album} /><View style={styles.albumOptionInfo}><Text style={styles.albumOptionTitle} numberOfLines={2}>{album.title}</Text><Text style={styles.albumOptionArtist} numberOfLines={1}>{album.artist || 'Artista desconhecido'}</Text></View><Text style={styles.albumOptionMark}>{isSelected ? '✓' : '+'}</Text></Pressable>; })}</View>{Boolean(errors.submit) && <Text style={styles.submitError}>{errors.submit}</Text>}<Pressable onPress={handleSubmit} style={styles.createButton}><Text style={styles.createButtonText}>{isFirstAccess ? 'CRIAR PERFIL' : 'SALVAR PERFIL'}</Text></Pressable></ScrollView>;
}

function ProfileScreen({ user, albums, onEdit }) {
  const [topAlbums, setTopAlbums] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.all(user.topAlbumIds.map((albumId) => getAlbumById(albumId))).then((albumResults) => {
      if (mounted) setTopAlbums(albumResults.filter(Boolean));
    });

    return () => {
      mounted = false;
    };
  }, [user.topAlbumIds]);

  return <ScrollView contentContainerStyle={styles.profile} showsVerticalScrollIndicator={false}><View style={styles.profileHeader}><UserAvatar user={user} large /><View style={styles.profileIdentity}><Text style={styles.profileName}>{user.name}</Text><Text style={styles.profileBio}>{user.bio || 'Ainda nao adicionou uma biografia.'}</Text></View></View><View style={styles.followStats}><View><Text style={styles.followNumber}>{user.followerIds.length}</Text><Text style={styles.followLabel}>SEGUIDORES</Text></View><View><Text style={styles.followNumber}>{user.followingIds.length}</Text><Text style={styles.followLabel}>SEGUINDO</Text></View></View><Pressable onPress={onEdit} style={styles.profileEditButton}><Text style={styles.profileEditText}>EDITAR PERFIL</Text></Pressable><Text style={styles.profileSectionTitle}>Top 3 artistas</Text><View style={styles.artistList}>{user.topArtists.length === 0 ? <Text style={styles.profileSecondary}>Nenhum artista definido ainda.</Text> : user.topArtists.slice(0, 3).map((artist, index) => <View key={`${artist}-${index}`} style={styles.artistItem}><Text style={styles.artistIndex}>0{index + 1}</Text><Text style={styles.artistName}>{artist}</Text></View>)}</View><Text style={styles.profileSectionTitle}>Top 3 albuns</Text><View style={styles.topAlbums}>{topAlbums.length === 0 ? <Text style={styles.profileSecondary}>Nenhum album definido ainda.</Text> : topAlbums.map((album) => <View key={album.id} style={styles.topAlbumItem}><AlbumCover album={album} /><Text style={styles.topAlbumTitle} numberOfLines={2}>{album.title}</Text></View>)}</View></ScrollView>;
}

function ProfileEditorModal({ visible, user, albums, onClose, onSaved }) {
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent><View style={styles.modalBackdrop}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Editar perfil</Text><Pressable onPress={onClose}><Text style={styles.closeButton}>FECHAR</Text></Pressable></View><ProfileForm initialUser={user} albums={albums} onSaved={(savedUser) => { onSaved(savedUser); onClose(); }} /></View></View></Modal>;
}

function FirstAccessScreen({ albums, onSaved }) {
  return <SafeAreaView style={styles.container}><StatusBar style="light" /><View style={styles.onboarding}><Text style={styles.eyebrow}>BEM-VINDO AO REPLAY</Text><Text style={styles.onboardingTitle}>Crie seu perfil{`\n`}para comecar.</Text><Text style={styles.onboardingCopy}>Escolha seu nome e uma foto. Voce podera completar seu perfil depois.</Text><ProfileForm albums={albums} onSaved={onSaved} /></View></SafeAreaView>;
}

function CreateAlbumForm({ initialAlbum, onSaved }) {
  const isEditing = Boolean(initialAlbum);
  const [title, setTitle] = useState(initialAlbum?.title || '');
  const [artist, setArtist] = useState(initialAlbum?.artist || '');
  const [description, setDescription] = useState(initialAlbum?.description || '');
  const [coverUrl, setCoverUrl] = useState(initialAlbum?.coverUrl || null);
  const [errors, setErrors] = useState({});

  async function handlePickCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setErrors((currentErrors) => ({ ...currentErrors, cover: 'Permita o acesso as fotos para escolher uma capa.' }));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const image = result.assets[0];
    setCoverUrl(`data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`);
    setErrors((currentErrors) => ({ ...currentErrors, cover: '' }));
  }

  async function handleSubmit() {
    const nextErrors = {};

    if (!title.trim()) nextErrors.title = 'Informe o nome do album.';
    if (!coverUrl) nextErrors.cover = 'Escolha uma capa para o album.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const album = {
      id: initialAlbum?.id || globalThis.crypto?.randomUUID?.() || `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: title.trim(),
      artist: artist.trim(),
      coverUrl,
      releaseDate: initialAlbum?.releaseDate || '',
      genres: initialAlbum?.genres || [],
      description: description.trim() || undefined,
      addedBy: initialAlbum?.addedBy || 'local-user',
      addedAt: initialAlbum?.addedAt || new Date().toISOString(),
    };

    if (isEditing) {
      await updateAlbum(album.id, album);
    } else {
      await saveAlbum(album);
    }
    onSaved(album);
  }

  return <ScrollView contentContainerStyle={styles.createForm} keyboardShouldPersistTaps="handled"><Pressable onPress={handlePickCover} style={[styles.coverPicker, errors.cover && styles.inputError]}>{coverUrl ? <Image source={{ uri: coverUrl }} style={styles.selectedCover} /> : <><Text style={styles.coverPickerPlus}>+</Text><Text style={styles.coverPickerText}>ESCOLHER CAPA</Text></>}</Pressable>{Boolean(errors.cover) && <Text style={styles.fieldError}>{errors.cover}</Text>}<Text style={styles.fieldLabel}>NOME DO ALBUM *</Text><TextInput value={title} onChangeText={(value) => { setTitle(value); if (value.trim()) setErrors((currentErrors) => ({ ...currentErrors, title: '' })); }} placeholder="Ex.: OK Computer" placeholderTextColor={palette.text} style={[styles.formInput, errors.title && styles.inputError]} />{Boolean(errors.title) && <Text style={styles.fieldError}>{errors.title}</Text>}<Text style={styles.fieldLabel}>ARTISTA</Text><TextInput value={artist} onChangeText={setArtist} placeholder="Nome do artista" placeholderTextColor={palette.text} style={styles.formInput} /><Text style={styles.fieldLabel}>DESCRICAO</Text><TextInput value={description} onChangeText={setDescription} placeholder="Conte um pouco sobre este album" placeholderTextColor={palette.text} style={[styles.formInput, styles.descriptionInput]} multiline textAlignVertical="top" /><Pressable onPress={handleSubmit} style={styles.createButton}><Text style={styles.createButtonText}>{isEditing ? 'SALVAR ALTERACOES' : 'CRIAR ALBUM'}</Text></Pressable></ScrollView>;
}

function AddAlbumModal({ visible, onClose, onSaved, initialAlbum = null }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('search');

  useEffect(() => {
    if (!visible) {
      setTerm('');
      setResults([]);
      setError('');
      setIsSearching(false);
      setMode(initialAlbum ? 'edit' : 'search');
      return undefined;
    }

    const normalizedTerm = term.trim();

    if (!normalizedTerm) {
      setResults([]);
      setError('');
      setIsSearching(false);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setError('');

      try {
        const nextResults = await musicSearch(normalizedTerm);
        if (!cancelled) setResults(nextResults);
      } catch {
        if (!cancelled) {
          setResults([]);
          setError('Nao foi possivel buscar agora. Tente novamente.');
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [term, visible]);

  async function handleAdd(result) {
    const album = { ...result, addedBy: 'local-user', addedAt: new Date().toISOString() };
    await saveAlbum(album);
    onSaved(album);
    setResults((currentResults) => currentResults.filter((item) => item.id !== result.id));
  }

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent><View style={styles.modalBackdrop}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{initialAlbum ? 'Editar album' : 'Adicionar album'}</Text><Pressable onPress={onClose}><Text style={styles.closeButton}>FECHAR</Text></Pressable></View>{initialAlbum ? <CreateAlbumForm initialAlbum={initialAlbum} onSaved={(album) => { onSaved(album); onClose(); }} /> : <><View style={styles.modeTabs}><Pressable onPress={() => setMode('search')} style={[styles.modeTab, mode === 'search' && styles.modeTabActive]}><Text style={[styles.modeTabText, mode === 'search' && styles.modeTabTextActive]}>BUSCAR</Text></Pressable><Pressable onPress={() => setMode('create')} style={[styles.modeTab, mode === 'create' && styles.modeTabActive]}><Text style={[styles.modeTabText, mode === 'create' && styles.modeTabTextActive]}>CRIAR ALBUM</Text></Pressable></View>{mode === 'create' ? <CreateAlbumForm onSaved={(album) => { onSaved(album); onClose(); }} /> : <><View style={styles.searchRow}><TextInput autoFocus value={term} onChangeText={setTerm} placeholder="Buscar por album ou artista" placeholderTextColor={palette.text} style={styles.searchInput} returnKeyType="search"/><View style={styles.searchButton}><Text style={styles.searchButtonText}>BUSCA AUTOMATICA</Text></View></View>{isSearching && <ActivityIndicator color={palette.accent} style={styles.loader} />}{Boolean(error) && <Text style={styles.errorText}>{error}</Text>}{!isSearching && results.length === 0 && <Text style={styles.searchHint}>{term ? 'Nenhum resultado encontrado.' : 'Pesquise um album para adicionar ao Replay.'}</Text>}<FlatList data={results} keyExtractor={(item) => item.id} renderItem={({ item }) => <SearchResult album={item} onAdd={() => handleAdd(item)} />} keyboardShouldPersistTaps="handled" /></>}</>}</View></View></Modal>;
}

function ExploreScreen({ albums, onAlbumPress, onAlbumAdded }) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [trending, setTrending] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const { width } = useWindowDimensions();
  const columnCount = width >= 700 ? 4 : width >= 440 ? 3 : 2;
  const cardWidth = (width - 40 - (columnCount - 1) * 14) / columnCount;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingTrending(true);
        const results = await getTrendingAlbums();
        if (mounted && Array.isArray(results) && results.length > 0) setTrending(results);
      } catch {
        // ignore errors and keep trending hidden
      } finally {
        if (mounted) setLoadingTrending(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleAddFromTrending(result) {
    const album = { ...result, addedBy: 'apple', addedAt: new Date().toISOString() };
    try {
      await saveAlbum(album);
      onAlbumAdded(album);
      setTrending((current) => current.filter((item) => item.id !== result.id));
    } catch {
      // ignore
    }
  }

  return (
    <View style={styles.explore}>
      <View style={styles.exploreHeader}>
        <View>
          <Text style={styles.eyebrow}>BIBLIOTECA</Text>
          <Text style={styles.pageTitle}>Explorar</Text>
        </View>
        <Pressable onPress={() => setIsModalVisible(true)} style={styles.addButton}>
          <Text style={styles.addButtonPlus}>+</Text>
          <Text style={styles.addButtonText}>ADICIONAR ALBUM</Text>
        </Pressable>
      </View>

      {trending.length > 0 && (
        <View style={{ marginBottom: 18 }}>
          <Text style={[styles.eyebrow, { marginLeft: 2 }]}>EM ALTA</Text>
          <FlatList
            data={trending}
            horizontal
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <TrendingCard album={item} onAdd={() => handleAddFromTrending(item)} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4 }}
            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
          />
        </View>
      )}

      {albums.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyMark}>02</Text>
          <Text style={styles.emptyTitle}>Sua biblioteca{`\n`}comeca aqui.</Text>
          <Text style={styles.emptyCopy}>Adicione o primeiro album para montar sua colecao no Replay.</Text>
          <Pressable onPress={() => setIsModalVisible(true)} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>ADICIONAR PRIMEIRO ALBUM</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          key={columnCount}
          data={albums}
          numColumns={columnCount}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AlbumCard album={item} cardWidth={cardWidth} onPress={() => onAlbumPress(item)} />}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <AddAlbumModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSaved={(album) => {
          onAlbumAdded(album);
          setIsModalVisible(false);
        }}
      />
    </View>
  );
}

function ReviewComments({ review, currentUser }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadComments() {
      try {
        const all = await getCommentsByReview(review.id);
        if (!mounted) return;
        setCommentCount(Array.isArray(all) ? all.length : 0);
        if (isExpanded) setComments(Array.isArray(all) ? all : []);
      } catch {
        if (!mounted) return;
        setCommentCount(0);
        if (isExpanded) setComments([]);
      }
    }

    loadComments();

    return () => {
      mounted = false;
    };
  }, [isExpanded, review.id]);

  async function handleAddComment() {
    const text = commentText.trim();
    if (!text) return;

    const comment = {
      id: globalThis.crypto?.randomUUID?.() || `comment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      reviewId: review.id,
      userId: currentUser.id,
      text,
      createdAt: new Date().toISOString(),
    };

    try {
      const all = await saveComment(comment);
      const filtered = Array.isArray(all) ? all.filter((item) => item.reviewId === review.id) : [];
      setComments(filtered);
      setCommentCount(filtered.length);
      setCommentText('');
    } catch {
      // ignore
    }
  }

  function handleRemoveComment(comment) {
    Alert.alert('Excluir comentario', 'Tem certeza que deseja excluir este comentario?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            const all = await removeComment(comment.id);
            const filtered = Array.isArray(all) ? all.filter((item) => item.reviewId === review.id) : [];
            setComments(filtered);
            setCommentCount(filtered.length);
          } catch {
            // ignore
          }
        },
      },
    ]);
  }

  return <View style={styles.commentThread}><Pressable onPress={() => setIsExpanded((expanded) => !expanded)} style={styles.commentToggle}><Text style={styles.commentToggleText}>▢ {commentCount} comentarios</Text><Text style={styles.commentToggleArrow}>{isExpanded ? '−' : '+'}</Text></Pressable>{isExpanded && <View style={styles.commentContent}>{comments.map((comment) => <View key={comment.id} style={styles.commentItem}><View style={styles.commentHeader}><Text style={styles.commentAuthor}>{comment.userId === currentUser.id ? currentUser.name : comment.userId}</Text>{comment.userId === currentUser.id && <Pressable onPress={() => handleRemoveComment(comment)}><Text style={styles.commentDelete}>EXCLUIR</Text></Pressable>}</View><Text style={styles.commentBody}>{comment.text}</Text></View>)}<View style={styles.commentInputRow}><TextInput value={commentText} onChangeText={setCommentText} placeholder="Escreva um comentario" placeholderTextColor={palette.text} style={styles.commentInput} multiline /><Pressable onPress={handleAddComment} style={styles.commentSendButton}><Text style={styles.commentSendText}>ENVIAR</Text></Pressable></View></View>}</View>;
}

function ReviewSection({ albumId, currentUser, reviews, onReviewsChange }) {
  const normalizedAlbumId = String(albumId);
  const existingReview = reviews.find((review) => review.userId === currentUser.id);
  const [rating, setRating] = useState(existingReview?.rating || 0.5);
  const [reviewText, setReviewText] = useState(existingReview?.reviewText || '');
  const average = reviews.length > 0 ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0;

  useEffect(() => {
    const userReview = reviews.find((review) => review.userId === currentUser.id);
    setRating(userReview?.rating || 0.5);
    setReviewText(userReview?.reviewText || '');
  }, [reviews, currentUser.id]);

  function handleSaveReview() {
    const review = {
      id: existingReview?.id || globalThis.crypto?.randomUUID?.() || `review-${Date.now()}`,
      albumId: normalizedAlbumId,
      userId: currentUser.id,
      rating,
      reviewText: reviewText.trim() || undefined,
      createdAt: existingReview?.createdAt || new Date().toISOString(),
      likedBy: existingReview?.likedBy ?? [],
    };

    (async () => {
      try {
        if (existingReview) {
          await updateReview(existingReview.id, review);
        } else {
          await saveReview(review);
        }
        const updated = await getReviewsByAlbum(normalizedAlbumId);
        onReviewsChange(updated);
      } catch {
        // ignore
      }
    })();
  }

  return <View style={styles.reviewSection}><View style={styles.ratingSummary}><Text style={styles.reviewSectionTitle}>Avaliacoes</Text><View style={styles.averageBox}><Text style={styles.averageValue}>{average ? average.toFixed(1) : '--'}</Text><Text style={styles.averageStars}>{average ? '★' : '☆'}</Text><Text style={styles.reviewCount}>{reviews.length} {reviews.length === 1 ? 'avaliacao' : 'avaliacoes'}</Text></View></View><Text style={styles.fieldLabel}>{existingReview ? 'SUA AVALIACAO' : 'AVALIE ESTE ALBUM'}</Text><View style={styles.ratingOptions}>{Array.from({ length: 10 }, (_, index) => (index + 1) / 2).map((option) => <Pressable key={option} onPress={() => setRating(option)} style={[styles.ratingOption, rating === option && styles.ratingOptionActive]}><Text style={[styles.ratingOptionText, rating === option && styles.ratingOptionTextActive]}>{option} ★</Text></Pressable>)}</View><TextInput value={reviewText} onChangeText={setReviewText} placeholder="Escreva uma resenha (opcional)" placeholderTextColor={palette.text} style={[styles.formInput, styles.reviewInput]} multiline textAlignVertical="top" /><Pressable onPress={handleSaveReview} style={styles.createButton}><Text style={styles.createButtonText}>{existingReview ? 'ATUALIZAR AVALIACAO' : 'SALVAR AVALIACAO'}</Text></Pressable><View style={styles.reviewList}>{reviews.length === 0 ? <Text style={styles.profileSecondary}>Ainda nao ha avaliacoes para este album.</Text> : reviews.map((review) => <ReviewItem key={review.id} review={review} currentUser={currentUser} onReviewsChange={onReviewsChange} />)}</View></View>;
}

function ReviewItem({ review, currentUser, onReviewsChange }) {
  const likedBy = review.likedBy ?? [];
  const isLiked = likedBy.includes(currentUser.id);

  async function handleToggleLike() {
    try {
      const updatedReviews = await toggleLike(review.id, currentUser.id);
      onReviewsChange(updatedReviews.filter((item) => String(item.albumId) === String(review.albumId)));
    } catch {
      // ignore
    }
  }

  return <View style={styles.reviewItem}><View style={styles.reviewItemHeader}><Text style={styles.reviewerName}>{review.userId === currentUser.id ? currentUser.name : review.userId}</Text><Text style={styles.reviewRating}>{review.rating.toFixed(1)} ★</Text></View>{Boolean(review.reviewText) && <Text style={styles.reviewText}>{review.reviewText}</Text>}<View style={styles.reviewSocialRow}><Pressable onPress={handleToggleLike} style={styles.socialButton}><Text style={[styles.likeIcon, isLiked && styles.likeIconActive]}>♥</Text><Text style={[styles.socialCount, isLiked && styles.socialCountActive]}>{likedBy.length}</Text></Pressable><ReviewComments review={review} currentUser={currentUser} /></View></View>;
}

function AlbumDetails({ album, currentUser, onBack, onEdit, onDelete }) {
  const [albumReviews, setAlbumReviews] = useState([]);
  const average = albumReviews.length > 0 ? albumReviews.reduce((total, review) => total + review.rating, 0) / albumReviews.length : 0;

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const reviews = await getReviewsByAlbum(album.id);
        if (mounted) setAlbumReviews(reviews);
      } catch {
        if (mounted) setAlbumReviews([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [album.id]);

  return <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.details} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled"><Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backButtonText}>← VOLTAR</Text></Pressable><AlbumCover album={album} large /><Text style={styles.detailsEyebrow}>DETALHE DO ALBUM</Text><View style={styles.detailsTitleRow}><View style={styles.detailsTitleWrap}><Text style={styles.detailsTitle}>{album.title}</Text><Text style={styles.detailsArtist}>{album.artist || 'Artista desconhecido'}</Text></View><View style={styles.detailAverage}><Text style={styles.detailAverageValue}>{average ? average.toFixed(1) : '--'}</Text><Text style={styles.detailAverageStar}>★</Text></View></View>{Boolean(album.description) && <Text style={styles.detailsDescription}>{album.description}</Text>}<View style={styles.detailsActions}><Pressable onPress={onEdit} style={styles.editButton}><Text style={styles.editButtonText}>EDITAR</Text></Pressable><Pressable onPress={onDelete} style={styles.deleteButton}><Text style={styles.deleteButtonText}>EXCLUIR</Text></Pressable></View><ReviewSection albumId={album.id} currentUser={currentUser} reviews={albumReviews} onReviewsChange={setAlbumReviews} /></ScrollView>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getAlbums(), getCurrentUser()]).then(([storedAlbums, storedUser]) => {
      if (!mounted) return;
      setAlbums(storedAlbums);
      setCurrentUser(storedUser);
    }).catch(() => {
      if (!mounted) return;
      setAlbums([]);
      setCurrentUser(null);
    });

    return () => {
      mounted = false;
    };
  }, []);

  function handleAlbumAdded(album) {
    setAlbums((currentAlbums) => currentAlbums.some((item) => item.id === album.id) ? currentAlbums : [...currentAlbums, album]);
  }

  function handleAlbumUpdated(album) {
    setAlbums((currentAlbums) => currentAlbums.map((item) => item.id === album.id ? album : item));
    setSelectedAlbum(album);
  }

  function handleAlbumDelete() {
    Alert.alert('Excluir album', `Tem certeza que deseja excluir ${selectedAlbum.title}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await removeAlbum(selectedAlbum.id);
          setAlbums((currentAlbums) => currentAlbums.filter((item) => item.id !== selectedAlbum.id));
          setSelectedAlbum(null);
        },
      },
    ]);
  }

  if (!currentUser) {
    return <FirstAccessScreen albums={albums} onSaved={setCurrentUser} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.content}>{selectedAlbum ? <AlbumDetails album={selectedAlbum} currentUser={currentUser} onBack={() => setSelectedAlbum(null)} onEdit={() => setIsEditModalVisible(true)} onDelete={handleAlbumDelete} /> : activeTab === 'explore' ? <ExploreScreen albums={albums} onAlbumPress={setSelectedAlbum} onAlbumAdded={handleAlbumAdded} /> : activeTab === 'profile' ? <ProfileScreen user={currentUser} albums={albums} onEdit={() => setIsEditModalVisible(true)} /> : <View />}</View>
      {selectedAlbum && <AddAlbumModal key={selectedAlbum.id} visible={isEditModalVisible} initialAlbum={selectedAlbum} onClose={() => setIsEditModalVisible(false)} onSaved={handleAlbumUpdated} />}
      {!selectedAlbum && <ProfileEditorModal visible={isEditModalVisible} user={currentUser} albums={albums} onClose={() => setIsEditModalVisible(false)} onSaved={setCurrentUser} />}
      <View style={styles.navBar}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return <Pressable key={tab.key} onPress={() => { setIsEditModalVisible(false); setSelectedAlbum(null); setActiveTab(tab.key); }} style={styles.navItem}><Text style={[styles.navMark, isActive && styles.navMarkActive]}>{tab.mark}</Text><Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text></Pressable>;
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: { flex: 1 },
  explore: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  exploreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 },
  eyebrow: { color: palette.accent, fontSize: 9, fontWeight: '700', letterSpacing: 1.6, marginBottom: 8 },
  pageTitle: { color: palette.title, fontSize: 36, fontWeight: '800' },
  addButton: { backgroundColor: palette.accent, minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  addButtonPlus: { color: palette.background, fontSize: 20, fontWeight: '400', lineHeight: 20 },
  addButtonText: { color: palette.background, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  gridContent: { paddingBottom: 24 },
  gridRow: { gap: 14, marginBottom: 24 },
  albumCard: { backgroundColor: palette.surface, borderRadius: 10, padding: 10, minWidth: 0, overflow: 'hidden' },
  pressed: { opacity: 0.65 },
  albumCover: { width: '100%', aspectRatio: 1, backgroundColor: palette.title, resizeMode: 'cover' },
  coverPlaceholder: { justifyContent: 'flex-end', padding: 10, borderWidth: 1, borderColor: palette.border },
  coverPlaceholderText: { color: palette.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  albumTitle: { color: '#F5F5F5', fontSize: 13, fontWeight: '700', marginTop: 9 },
  albumArtist: { color: palette.text, fontSize: 11, marginTop: 4 },
  emptyState: { flex: 1, justifyContent: 'center', paddingBottom: 40 },
  emptyMark: { color: palette.accent, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 18 },
  emptyTitle: { color: palette.title, fontSize: 38, lineHeight: 40, fontWeight: '800', marginBottom: 14 },
  emptyCopy: { color: palette.text, fontSize: 15, lineHeight: 22, maxWidth: 290, marginBottom: 24 },
  emptyButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: palette.accent, paddingHorizontal: 16, paddingVertical: 13 },
  emptyButtonText: { color: palette.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  modalContent: { backgroundColor: '#111513', borderTopWidth: 1, borderTopColor: palette.accent, minHeight: '72%', maxHeight: '90%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: palette.title, fontSize: 22, fontWeight: '800' },
  closeButton: { color: palette.text, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  modeTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.border, marginBottom: 18 },
  modeTab: { paddingBottom: 11, marginRight: 22 },
  modeTabActive: { borderBottomWidth: 2, borderBottomColor: palette.accent },
  modeTabText: { color: palette.text, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  modeTabTextActive: { color: palette.accent },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: palette.border, color: palette.title, paddingHorizontal: 12, height: 46, fontSize: 13 },
  searchButton: { backgroundColor: palette.accent, justifyContent: 'center', paddingHorizontal: 14 },
  searchButtonText: { color: palette.background, fontSize: 9, fontWeight: '900' },
  loader: { marginVertical: 20 },
  errorText: { color: '#FF6B6B', fontSize: 12, marginBottom: 12 },
  searchHint: { color: palette.text, fontSize: 13, lineHeight: 19, paddingVertical: 14 },
  createForm: { paddingBottom: 28 },
  coverPicker: { width: 136, height: 136, alignSelf: 'center', borderWidth: 1, borderColor: palette.accent, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' },
  selectedCover: { width: '100%', height: '100%' },
  coverPickerPlus: { color: palette.accent, fontSize: 30, lineHeight: 32 },
  coverPickerText: { color: palette.accent, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  fieldLabel: { color: palette.text, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 15, marginBottom: 7 },
  formInput: { borderWidth: 1, borderColor: palette.border, color: palette.title, fontSize: 13, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10 },
  descriptionInput: { minHeight: 92 },
  inputError: { borderColor: '#FF6B6B' },
  fieldError: { color: '#FF6B6B', fontSize: 11, marginTop: 5 },
  createButton: { backgroundColor: palette.accent, alignItems: 'center', paddingVertical: 14, marginTop: 22 },
  createButtonText: { color: palette.background, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  onboarding: { flex: 1, paddingHorizontal: 24, paddingTop: 44 },
  onboardingTitle: { color: '#F5F5F5', fontSize: 38, lineHeight: 40, fontWeight: '800', marginBottom: 14 },
  onboardingCopy: { color: palette.text, fontSize: 15, lineHeight: 22, marginBottom: 20, maxWidth: 320 },
  profile: { padding: 24, paddingBottom: 40 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  profileIdentity: { flex: 1, marginLeft: 18 },
  userAvatar: { width: 72, height: 72, backgroundColor: palette.surface },
  largeUserAvatar: { width: 104, height: 104, borderRadius: 52 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.accent, borderRadius: 36 },
  avatarInitial: { color: palette.accent, fontSize: 25, fontWeight: '800' },
  largeAvatarInitial: { fontSize: 38 },
  profileName: { color: '#F5F5F5', fontSize: 28, fontWeight: '800', marginBottom: 7 },
  profileBio: { color: palette.text, fontSize: 13, lineHeight: 19 },
  followStats: { flexDirection: 'row', gap: 42, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border, paddingVertical: 15, marginBottom: 16 },
  followNumber: { color: '#F5F5F5', fontSize: 21, fontWeight: '700' },
  followLabel: { color: palette.text, fontSize: 8, letterSpacing: 1, marginTop: 4 },
  profileEditButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: palette.accent, paddingHorizontal: 15, paddingVertical: 11, marginBottom: 32 },
  profileEditText: { color: palette.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  profileSectionTitle: { color: '#F5F5F5', fontSize: 18, fontWeight: '700', marginBottom: 14 },
  artistList: { marginBottom: 30 },
  artistItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: palette.border, paddingVertical: 12 },
  artistIndex: { color: palette.accent, fontSize: 10, fontWeight: '800', width: 34 },
  artistName: { color: '#F5F5F5', fontSize: 15, fontWeight: '600' },
  profileSecondary: { color: palette.text, fontSize: 13 },
  topAlbums: { flexDirection: 'row', gap: 12 },
  topAlbumItem: { width: 104 },
  topAlbumTitle: { color: '#F5F5F5', fontSize: 11, fontWeight: '700', marginTop: 7 },
  trendingCard: { width: 132, marginRight: 12 },
  trendingCover: { width: 132, aspectRatio: 1, borderRadius: 8, backgroundColor: palette.title, resizeMode: 'cover' },
  trendingTitle: { color: '#F5F5F5', fontSize: 12, fontWeight: '700', marginTop: 8 },
  trendingArtist: { color: palette.text, fontSize: 11, marginTop: 4 },
  trendingAddButton: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  profileForm: { paddingBottom: 30 },
  profilePhotoPicker: { width: 128, height: 128, alignSelf: 'center', borderWidth: 1, borderColor: palette.accent, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden', borderRadius: 64 },
  selectedProfilePhoto: { width: '100%', height: '100%' },
  selectionHint: { color: palette.text, fontSize: 12, marginBottom: 10 },
  albumSelection: { gap: 8 },
  albumOption: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.border, padding: 7, backgroundColor: palette.surface },
  albumOptionSelected: { borderColor: palette.accent },
  albumOptionInfo: { flex: 1, paddingHorizontal: 10 },
  albumOptionTitle: { color: '#F5F5F5', fontSize: 12, fontWeight: '700' },
  albumOptionArtist: { color: palette.text, fontSize: 10, marginTop: 3 },
  albumOptionMark: { color: palette.accent, fontSize: 21, width: 25, textAlign: 'center' },
  searchResult: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 10 },
  searchResultInfo: { flex: 1, paddingHorizontal: 12 },
  searchResultTitle: { color: palette.title, fontSize: 13, fontWeight: '700' },
  searchResultArtist: { color: palette.text, fontSize: 11, marginTop: 4 },
  addSmallButton: { width: 34, height: 34, borderWidth: 1, borderColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  addSmallButtonText: { color: palette.accent, fontSize: 22, lineHeight: 23 },
  detailsScroll: { flex: 1 },
  details: { padding: 24, paddingBottom: 48 },
  backButton: { alignSelf: 'flex-start', marginBottom: 28 },
  backButtonText: { color: palette.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  largeCover: { width: '70%', alignSelf: 'center', marginBottom: 28 },
  detailsEyebrow: { color: palette.accent, fontSize: 9, fontWeight: '700', letterSpacing: 1.4, marginBottom: 10 },
  detailsTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailsTitleWrap: { flex: 1, paddingRight: 16 },
  detailsTitle: { color: palette.title, fontSize: 32, fontWeight: '800' },
  detailsArtist: { color: palette.text, fontSize: 16, marginTop: 7 },
  detailAverage: { alignItems: 'center', minWidth: 50 },
  detailAverageValue: { color: '#F5F5F5', fontSize: 23, fontWeight: '800' },
  detailAverageStar: { color: palette.accent, fontSize: 16, marginTop: 1 },
  detailsDescription: { color: palette.text, fontSize: 14, lineHeight: 21, marginTop: 20 },
  detailsPlaceholder: { color: palette.text, fontSize: 14, lineHeight: 21, marginTop: 32, maxWidth: 300 },
  detailsActions: { flexDirection: 'row', gap: 10, marginTop: 28, marginBottom: 24 },
  editButton: { borderWidth: 1, borderColor: palette.accent, paddingHorizontal: 22, paddingVertical: 13 },
  editButtonText: { color: palette.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  deleteButton: { borderWidth: 1, borderColor: '#FF6B6B', paddingHorizontal: 22, paddingVertical: 13 },
  deleteButtonText: { color: '#FF6B6B', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  reviewSection: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 24, marginTop: 8, paddingBottom: 28 },
  ratingSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  reviewSectionTitle: { color: '#F5F5F5', fontSize: 20, fontWeight: '800' },
  averageBox: { alignItems: 'flex-end' },
  averageValue: { color: '#F5F5F5', fontSize: 22, fontWeight: '800' },
  averageStars: { color: palette.accent, fontSize: 15 },
  reviewCount: { color: palette.text, fontSize: 9, marginTop: 3 },
  ratingOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  ratingOption: { borderWidth: 1, borderColor: palette.border, paddingHorizontal: 9, paddingVertical: 8 },
  ratingOptionActive: { borderColor: palette.accent, backgroundColor: palette.surface },
  ratingOptionText: { color: palette.text, fontSize: 11, fontWeight: '700' },
  ratingOptionTextActive: { color: palette.accent },
  reviewInput: { minHeight: 88, marginTop: 5 },
  reviewList: { marginTop: 28 },
  reviewItem: { borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 14 },
  reviewItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  reviewerName: { color: '#F5F5F5', fontSize: 13, fontWeight: '700' },
  reviewRating: { color: palette.accent, fontSize: 12, fontWeight: '800' },
  reviewText: { color: palette.text, fontSize: 13, lineHeight: 19 },
  reviewSocialRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 18 },
  socialButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  likeIcon: { color: palette.text, fontSize: 17 },
  likeIconActive: { color: palette.accent },
  socialCount: { color: palette.text, fontSize: 11 },
  socialCountActive: { color: palette.accent },
  commentThread: { flex: 1 },
  commentToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  commentToggleText: { color: palette.text, fontSize: 11 },
  commentToggleArrow: { color: palette.accent, fontSize: 18, lineHeight: 18 },
  commentContent: { marginTop: 10, backgroundColor: palette.surface, padding: 10, borderRadius: 8 },
  commentItem: { paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: palette.border },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { color: '#F5F5F5', fontSize: 11, fontWeight: '700' },
  commentDelete: { color: '#FF6B6B', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  commentBody: { color: palette.text, fontSize: 12, lineHeight: 18 },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  commentInput: { flex: 1, minHeight: 40, maxHeight: 80, borderWidth: 1, borderColor: palette.border, color: '#F5F5F5', paddingHorizontal: 9, paddingVertical: 8, fontSize: 11 },
  commentSendButton: { backgroundColor: palette.accent, minHeight: 40, justifyContent: 'center', paddingHorizontal: 10 },
  commentSendText: { color: palette.background, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  navBar: { height: 76, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: '#0D100F', flexDirection: 'row', paddingHorizontal: 10, paddingTop: 12 },
  navItem: { flex: 1, alignItems: 'center', gap: 5 },
  navMark: { color: palette.text, fontSize: 10, fontWeight: '700' },
  navMarkActive: { color: palette.accent },
  navLabel: { color: palette.text, fontSize: 10 },
  navLabelActive: { color: palette.title, fontWeight: '700' },
});
