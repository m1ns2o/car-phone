import SwiftUI

struct FriendsView: View {
  @EnvironmentObject var auth: AuthState
  @State private var friends: [Friend] = []
  @State private var requests: [FriendRequest] = []
  @State private var username = ""
  @State private var error: String?
  @State private var callTarget: CallTarget?

  var body: some View {
    NavigationStack {
      List {
        Section("친구 추가") {
          HStack {
            TextField("username", text: $username)
              .autocapitalization(.none)
            Button("요청") { Task { await add() } }
          }
        }
        if !requests.isEmpty {
          Section("받은 요청") {
            ForEach(requests) { r in
              HStack {
                Text(r.fromUsername)
                Spacer()
                Button("수락") { Task { await accept(id: r.id) } }
                Button("거절") { Task { await reject(id: r.id) } }
                  .foregroundColor(.red)
              }
            }
          }
        }
        Section("친구 (\(friends.count))") {
          ForEach(friends) { f in
            HStack {
              Circle().fill(f.online ? Color.green : Color.gray)
                .frame(width: 10, height: 10)
              Text(f.username)
              Spacer()
              Button {
                callTarget = CallTarget(room: "dm-\(f.id.prefix(6))", peerId: f.id, peerName: f.username)
              } label: {
                Image(systemName: "phone.fill")
              }
            }
          }
          .onDelete { idx in
            if let i = idx.first { Task { await remove(id: friends[i].id) } }
          }
        }
        if let error {
          Section { Text(error).foregroundColor(.red).font(.caption) }
        }
      }
      .navigationTitle("친구")
      .refreshable { await load() }
      .task { await load() }
      .navigationDestination(item: $callTarget) { t in
        CallView(vm: CallViewModel(
          roomId: t.room, name: auth.me?.username ?? Store.shared.displayName,
          inviteTo: t.peerId, inviteFrom: auth.me?.id, peerUserId: t.peerId,
          peerName: t.peerName, myUserId: auth.me?.id))
      }

    }
  }

  private func load() async {
    do {
      async let f = API.shared.friends()
      async let r = API.shared.incomingRequests()
      friends = try await f; requests = try await r; error = nil
    } catch { self.error = error.localizedDescription }
  }
  private func add() async {
    do { try await API.shared.requestFriend(username: username); username = ""; await load() }
    catch { self.error = error.localizedDescription }
  }
  private func accept(id: String) async {
    do { try await API.shared.acceptRequest(id: id); await load() }
    catch { self.error = error.localizedDescription }
  }
  private func reject(id: String) async {
    do { try await API.shared.rejectRequest(id: id); await load() }
    catch { self.error = error.localizedDescription }
  }
  private func remove(id: String) async {
    do { try await API.shared.removeFriend(id: id); await load() }
    catch { self.error = error.localizedDescription }
  }
}

struct CallTarget: Identifiable, Hashable {
  let id = UUID()
  let room: String
  let peerId: String
  let peerName: String
}
