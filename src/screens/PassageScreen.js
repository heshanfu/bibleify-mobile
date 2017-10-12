//@flow
import React, { Component } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  Image,
  Clipboard,
  Share,
  NativeModules,
  findNodeHandle,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  BackHandler
} from "react-native";
const Realm = require("realm");
import DrawerLayout from "react-native-drawer-layout";
import Books from "../constants/Books";
import GestureRecognizer, {
  swipeDirections
} from "react-native-swipe-gestures";
import Icon from "react-native-vector-icons/Ionicons";
import Video from "react-native-video";

UIManager.setLayoutAnimationEnabledExperimental &&
  UIManager.setLayoutAnimationEnabledExperimental(true);

const RCTUIManager = require("NativeModules").UIManager;

const PassageSchema = {
  name: "Passage",
  primaryKey: "id",
  properties: {
    id: "string",
    content: "string",
    book: "string",
    chapter: "int",
    verse: "int",
    type: "string"
  }
};

class PassageScreen extends Component {
  _drawer;
  _scrollView;
  state = {
    verses: [],
    activeBook: Books[0],
    activeChapter: 1,
    activeVerse: 1,
    jumpText: "",
    selectedVerses: [],
    streamUrl: null,
    streamChapter: null,
    isLoadingSound: true,
    paused: false
  };
  componentDidUpdate(prevProps, prevState) {
    if (
      this.state.activeBook != prevState.activeBook ||
      this.state.activeChapter != prevState.activeChapter ||
      this.state.activeVerse != prevState.activeVerse
    ) {
      this.loadPassage(() => {
        setTimeout(() => {
          if (this.state.activeVerse != prevState.activeVerse) {
            this.refs[
              `verse${this.state.activeVerse}`
            ].measureLayout(
              findNodeHandle(this._scrollView),
              (ox, oy, width, height, px, py) => {
                this._scrollView.scrollTo({
                  x: 0,
                  y: oy,
                  animated: true
                });
              }
            );
            this.setState({
              selectedVerses: [this.state.activeVerse]
            });
          }
        }, 200);
      });
    }
  }
  loadPassage(callback) {
    Realm.open({ schema: [PassageSchema], readOnly: true }).then(realm => {
      const { activeBook, activeChapter, activeVerse } = this.state;
      let passages = realm.objects("Passage");
      let filteredPassages = passages.filtered(
        `book = "${activeBook.value}" AND chapter = "${activeChapter}"`
      );
      const versesRaw = Object.keys(filteredPassages);
      if (versesRaw.length) {
        const verses = versesRaw.map(key => filteredPassages[key]);
        this.setState(
          {
            verses: verses
          },
          () => {
            callback && callback();
          }
        );
      }
    });
  }
  componentWillReceiveProps(nextProps) {
    const { jumpPassage } = nextProps;
    if (this.props.jumpPassage != jumpPassage && jumpPassage) {
      const activeBook = Books.filter(
        book => book.value == jumpPassage.book
      )[0];
      if (activeBook) {
        this.setState({
          activeBook,
          activeChapter: jumpPassage.chapter,
          activeVerse: jumpPassage.verse
        });
      }
    }
  }
  componentDidMount() {
    BackHandler.addEventListener("hardwareBackPress", () => {
      if (this.state.selectedVerses.length) {
        this.setState({
          selectedVerses: []
        });
        return true;
      }
      return false;
    });
    setTimeout(() => {
      this.loadPassage();
    }, 100);
  }
  _changeActiveBook(book) {
    this.setState({
      activeBook: book
    });
  }
  _changeActiveChapter(chapter) {
    this.setState(
      {
        activeChapter: chapter
      },
      () => {
        this._drawer.closeDrawer();
      }
    );
  }
  _onSwipeLeft(gestureState) {
    console.log(gestureState);
    if (Math.abs(gestureState.dx) > 90) {
      const nextChapter = this.state.activeChapter + 1;
      if (nextChapter <= this.state.activeBook.total) {
        this.setState({
          activeChapter: nextChapter,
          selectedVerses: []
        });
        setTimeout(() => {
          this._scrollView.scrollTo({ x: 0, y: 0, animated: true });
        });
      }
    }
  }
  _onSwipeRight(gestureState) {
    console.log(gestureState);
    if (Math.abs(gestureState.dx) > 90) {
      const prevChapter = this.state.activeChapter - 1;
      if (prevChapter > 0) {
        this.setState({
          activeChapter: prevChapter,
          selectedVerses: []
        });
        setTimeout(() => {
          this._scrollView.scrollTo({ x: 0, y: 0, animated: true });
        });
      }
    }
  }
  _renderBook(book, i) {
    const { activeBook, activeChapter } = this.state;
    const isBookActive = activeBook.value == book.value;
    const bookButtonView = (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.book, isBookActive ? styles.bookActive : null]}
        key={`${book.value}-${i}`}
        onPress={() => this._changeActiveBook(book)}
      >
        <Text style={styles.bookText}>{book.name_id}</Text>
      </TouchableOpacity>
    );
    if (isBookActive) {
      let chapters = [];
      for (var i = 1; i <= book.total; i++) {
        chapters.push(i);
      }
      return (
        <View key={`${book.value}-${i}`}>
          {bookButtonView}
          <View style={styles.chapterSelector}>
            <ScrollView
              horizontal={true}
              contentContainerStyle={styles.chapterScroll}
            >
              {chapters.map(chapter => {
                const isChapterActive = chapter == activeChapter;
                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    key={`${book.value}-${chapter}`}
                    style={styles.chapter}
                    onPress={() => this._changeActiveChapter(chapter)}
                  >
                    {isChapterActive ? (
                      <View style={styles.chapterActive}>
                        <Text
                          style={[styles.chapterText, styles.chapterTextActive]}
                        >
                          {chapter}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.chapterText}>{chapter}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      );
    } else {
      return bookButtonView;
    }
  }
  _onJumpText(jumpText) {
    this.setState({ jumpText });
  }
  _onSubmitJump() {
    let jumpText = this.state.jumpText;
    if (jumpText.indexOf(" ") != -1) {
      let currentVerse = 1;
      if (jumpText.indexOf(":") != -1) {
        const splitVerse = jumpText.split(":");
        currentVerse = parseInt(splitVerse[1]);
        jumpText = splitVerse[0];
      }
      const splitChapter = jumpText.replace("  ", " ").split(" ");
      const activeBook = Books.filter(
        book =>
          book.name_id.toLowerCase().indexOf(splitChapter[0].toLowerCase()) !=
          -1
      )[0];
      const currentChapter = parseInt(splitChapter[1]);
      if (activeBook) {
        this.setState({
          activeBook: activeBook,
          activeChapter: currentChapter,
          activeVerse: currentVerse
        });
        this._drawer.closeDrawer();
      }
    }
  }
  _onClearJump() {
    this.setState({
      jumpText: ""
    });
  }
  _renderDrawer() {
    const { jumpText } = this.state;
    return (
      <View style={styles.drawerWrapper}>
        <View style={styles.drawerHeader}>
          <TouchableOpacity activeOpacity={0.7} style={styles.drawerVersion}>
            <Text style={styles.versionText}>Terjemahan Baru</Text>
            <Icon name="ios-book" size={25} color="#fff" />
          </TouchableOpacity>
          <TextInput
            placeholder={"Jump here"}
            placeholderTextColor={"rgba(255,255,255,0.3)"}
            value={jumpText}
            style={styles.input}
            onSubmitEditing={() => this._onSubmitJump()}
            onChangeText={jumpText => this._onJumpText(jumpText)}
          />
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.clearJump}
            onPress={() => this._onClearJump()}
          >
            <Icon name="ios-close" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView>
          <Text style={styles.separator}>OLD TESTAMENT</Text>
          {Books.filter(
            book =>
              book.type == "old" &&
              book.name_id.toLowerCase().indexOf(jumpText.toLowerCase()) != -1
          ).map((book, i) => {
            return this._renderBook(book, i);
          })}
          <Text style={styles.separator}>NEW TESTAMENT</Text>
          {Books.filter(
            book =>
              book.type == "new" &&
              book.name_id.toLowerCase().indexOf(jumpText.toLowerCase()) != -1
          ).map((book, i) => {
            return this._renderBook(book, i);
          })}
        </ScrollView>
      </View>
    );
  }
  _openDrawer() {
    this._drawer.openDrawer();
  }
  _onShowSearch() {
    this.props.onShowSearch && this.props.onShowSearch();
  }
  _onPlayStreaming() {
    const { activeBook, activeChapter } = this.state;
    const url = `https://api.soundcloud.com/playlists/${activeBook.playlistId}?client_id=b05c630c718333adaf44c63b4deb5c88&limit=150&offset=0`;
    console.log(url);

    fetch(url)
      .then(res => res.json())
      .then(result => {
        const data = result.tracks.map(item => ({
          stream: item.stream_url,
          title: item.title,
          permalink: item.permalink
        }));
        let bookName = activeBook.name_id
          .replace(/ /g, "")
          .replace(/\-/g, "")
          .toUpperCase();
        if (bookName == "HAKIMHAKIM") bookName = "HAKIM";
        if (bookName == "KISAHPARARASUL") bookName = "KISAH PARA RASUL";
        console.log(bookName);
        const streamSong = data.filter(item => {
          return (
            item.title.toUpperCase().endsWith(`${bookName}${activeChapter}`) ||
            item.title.toUpperCase().endsWith(`${bookName}0${activeChapter}`)
          );
        })[0];
        if (streamSong) {
          LayoutAnimation.easeInEaseOut();
          if (this.state.streamUrl) {
            this.setState(
              {
                streamUrl: null,
                streamChapter: null
              },
              () => {
                setTimeout(() => {
                  const streamUrl = `${streamSong.stream}?client_id=b05c630c718333adaf44c63b4deb5c88`;
                  this.setState({
                    streamUrl,
                    streamChapter: {
                      activeBook,
                      activeChapter
                    },
                    isLoadingSound: true
                  });
                  console.log("PLAYING", streamUrl);
                }, 1000);
              }
            );
          } else {
            const streamUrl = `${streamSong.stream}?client_id=b05c630c718333adaf44c63b4deb5c88`;
            this.setState({
              streamUrl,
              streamChapter: {
                activeBook,
                activeChapter
              },
              isLoadingSound: true
            });
            console.log("PLAYING", streamUrl);
          }
        }
      });
  }
  _onSelectVerse(verse) {
    const { selectedVerses } = this.state;
    if (selectedVerses.indexOf(verse) != -1) {
      this.setState({
        selectedVerses: selectedVerses.filter(item => item != verse)
      });
    } else {
      this.setState({
        selectedVerses: [...selectedVerses, verse]
      });
    }
  }
  _onBackToolbar() {
    this.setState({
      selectedVerses: []
    });
  }
  _onCopyVerse() {
    const { selectedVerses, verses } = this.state;

    const contentList = selectedVerses.map(item => {
      const currentVerse = verses.filter(current => current.verse == item)[0];
      if (!currentVerse) return "";
      return `${currentVerse.content} (${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse})\n`;
    });
    Clipboard.setString(contentList.join("\n"));
    this.setState({
      selectedVerses: []
    });
  }
  _onShareVerse() {
    const { selectedVerses, verses } = this.state;

    const contentList = selectedVerses.map(item => {
      const currentVerse = verses.filter(current => current.verse == item)[0];
      if (!currentVerse) return "";
      return `${currentVerse.content} (${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse})\n`;
    });
    const shareContent = contentList.join("\n");
    Share.share({
      message: shareContent,
      title: "Alkitab App",
      url: ""
    });
  }
  _renderToolbar() {
    const { verses, activeBook, activeChapter, selectedVerses } = this.state;
    if (selectedVerses.length) {
      return (
        <View style={styles.toolbar}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.actionButton, { marginLeft: 10, flex: 1 }]}
            onPress={() => this._onBackToolbar()}
          >
            <Icon
              name="ios-arrow-back"
              size={25}
              color="#fff"
              style={{ backgroundColor: "transparent" }}
            />
          </TouchableOpacity>
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionButton}
              onPress={() => this._onCopyVerse()}
            >
              <Icon
                name="ios-copy"
                size={25}
                color="#fff"
                style={{ backgroundColor: "transparent" }}
              />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionButton}
              onPress={() => this._onShareVerse()}
            >
              <Icon
                name="ios-share-alt"
                size={25}
                color="#fff"
                style={{ backgroundColor: "transparent" }}
              />
            </TouchableOpacity>
          </View>
        </View>
      );
    } else {
      return (
        <View style={styles.toolbar}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.titleButton}
            onPress={() => this._openDrawer()}
          >
            <Text style={styles.toolbarTitle}>
              {activeBook.name_id} {activeChapter}
            </Text>
          </TouchableOpacity>
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionButton}
              onPress={() => this._onShowSearch()}
            >
              <Icon
                name="ios-search"
                size={25}
                color="#fff"
                style={{ backgroundColor: "transparent" }}
              />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionButton}
              onPress={() => this._onPlayStreaming()}
            >
              <Icon
                name="ios-headset"
                size={25}
                color="#fff"
                style={{ backgroundColor: "transparent" }}
              />
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  }
  onPlayProgress = ({ currentTime }) => {
    if (currentTime > 0 && this.state.isLoadingSound) {
      this.setState({
        isLoadingSound: false
      });
    }
    console.log("PROGRESS", currentTime);
  };

  onPlayEnd = () => {};

  onTogglePaused() {
    this.setState({
      paused: !this.state.paused
    });
  }

  onClosePlayer() {
    LayoutAnimation.easeInEaseOut();
    this.setState({
      streamUrl: null,
      streamChapter: null
    });
  }

  render() {
    const {
      verses,
      activeBook,
      activeChapter,
      streamUrl,
      streamChapter,
      paused,
      isLoadingSound
    } = this.state;
    const swipeConfig = {
      velocityThreshold: 0.3,
      directionalOffsetThreshold: 50
    };
    return (
      <DrawerLayout
        ref={drawer => {
          this._drawer = drawer;
        }}
        drawerWidth={300}
        drawerPosition={DrawerLayout.positions.Left}
        renderNavigationView={this._renderDrawer.bind(this)}
      >
        {this._renderToolbar()}
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.innerScroll,
            streamUrl ? { paddingBottom: 100 } : { paddingBottom: 20 }
          ]}
          ref={scrollView => (this._scrollView = scrollView)}
        >
          <GestureRecognizer
            onSwipeLeft={state => this._onSwipeLeft(state)}
            onSwipeRight={state => this._onSwipeRight(state)}
            config={swipeConfig}
          >
            {verses.map((verse, i) => {
              const isTitle = verse.type == "t";
              const { selectedVerses } = this.state;
              const isSelected = selectedVerses.indexOf(verse.verse) != -1;
              return (
                <View
                  key={i}
                  ref={"verse" + verse.verse}
                  style={[isSelected ? styles.selectedVerse : null]}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => this._onSelectVerse(verse.verse)}
                  >
                    <Text
                      style={[
                        styles.text,
                        isTitle ? styles.title : null,
                        isSelected ? styles.textSelected : null
                      ]}
                    >
                      {!isTitle ? (
                        <Text style={styles.verseNumber}>{verse.verse} </Text>
                      ) : null}
                      {verse.content}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </GestureRecognizer>
          {streamUrl ? (
            <Video
              source={{ uri: streamUrl }}
              ref="audio"
              volume={1.0}
              muted={false}
              paused={paused}
              playInBackground={true}
              playWhenInactive={true}
              onProgress={this.onPlayProgress}
              onEnd={this.onPlayEnd}
              resizeMode="cover"
              repeat={false}
            />
          ) : null}
        </ScrollView>
        <View style={[styles.player, { bottom: streamUrl ? 0 : -80 }]}>
          <View style={styles.row}>
            {isLoadingSound ? (
              <View style={styles.playButton}>
                <ActivityIndicator />
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.playButton}
                onPress={() => this.onTogglePaused()}
              >
                {paused ? (
                  <Icon name="ios-play" size={25} color="#1f364d" />
                ) : (
                  <Icon name="ios-pause" size={25} color="#1f364d" />
                )}
              </TouchableOpacity>
            )}
            <Text style={styles.playerText}>
              {streamChapter && streamChapter.activeBook.name_id}{" "}
              {streamChapter && streamChapter.activeChapter}
            </Text>
            <Image
              source={require("AlkitabApp/assets/alkitabsuara.png")}
              style={styles.playerImage}
              resizeMode={"contain"}
            />
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.closeButton}
              onPress={() => this.onClosePlayer()}
            >
              <Icon name="ios-close" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </DrawerLayout>
    );
  }
}

const styles = StyleSheet.create({
  toolbar: {
    paddingTop: Platform.OS == "ios" ? 20 : 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f364d",
    height: Platform.OS == "ios" ? 80 : 60
  },
  titleButton: {
    flex: 1,
    paddingHorizontal: 25
  },
  toolbarTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "300",
    backgroundColor: "transparent"
  },
  innerScroll: {
    paddingVertical: 15
  },
  actions: {
    flexDirection: "row",
    marginRight: 10
  },
  actionButton: {
    paddingHorizontal: 20
  },
  icon: {},
  container: {
    flex: 1,
    backgroundColor: "#0D233A"
  },
  drawerWrapper: {
    backgroundColor: "#1f364d",
    flex: 1,
    paddingTop: 20
  },
  text: {
    color: "#fff",
    lineHeight: 30,
    paddingHorizontal: 25
  },
  title: {
    fontWeight: "900"
  },
  separator: {
    fontWeight: "900",
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    marginVertical: 10,
    marginLeft: 20
  },
  book: {
    paddingHorizontal: 25,
    paddingVertical: 20
  },
  bookText: {
    color: "#fff",
    fontWeight: "300"
  },
  bookActive: {
    backgroundColor: "#26405A"
  },
  chapterSelector: {
    height: 60,
    backgroundColor: "#26405A"
  },
  chapter: {
    height: 60,
    width: 60,
    justifyContent: "center",
    alignItems: "center"
  },
  chapterText: {
    color: "#fff"
  },
  chapterActive: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center"
  },
  chapterTextActive: {
    color: "#0D233A"
  },
  chapterScroll: {
    paddingHorizontal: 20
  },
  verseNumber: {
    fontWeight: "900",
    paddingRight: 20,
    color: "#26405A",
    fontSize: 10
  },
  drawerHeader: {
    height: 100
  },
  drawerVersion: {
    flexDirection: "row",
    height: 25,
    alignItems: "center",
    paddingHorizontal: 20,
    flex: 1
  },
  versionText: {
    color: "#fff",
    flex: 1
  },
  input: {
    flex: 1,
    height: 20,
    backgroundColor: "#26405A",
    margin: 5,
    marginBottom: 10,
    marginHorizontal: 10,
    borderRadius: 7,
    paddingHorizontal: 10,
    color: "#fff",
    fontSize: 13
  },
  clearJump: {
    position: "absolute",
    right: 10,
    top: 55,
    height: 30,
    width: 30,
    backgroundColor: "transparent"
  },
  selectedVerse: {
    backgroundColor: "#fff"
  },
  textSelected: {
    color: "#1f364d"
  },
  player: {
    height: 80,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1f364d",
    paddingHorizontal: 20,
    paddingVertical: 15
  },
  playButton: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 25
  },
  closeButton: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center"
  },
  playerImage: {
    width: 70,
    height: 45
  },
  row: {
    flexDirection: "row",
    alignItems: "center"
  },
  playerText: {
    flex: 1,
    color: "#fff",
    paddingHorizontal: 10
  }
});

export default PassageScreen;
