create schema if not exists findnearbyplaces;


create table findnearbyplaces.category
(
    id smallserial primary key,
    name varchar(30) not null
)

create table findnearbyplaces.customer
(
    id serial primary key,
    email varchar(256) not null unique,
    password varchar(100) not null
)

create table findnearbyplaces.place
(
    id bigserial primary key,
    name varchar(256) not null,
    latitude decimal(8,6) not null,
    longitude decimal(9,6) not null,
    description varchar(512) not null,
    category_id smallint references findnearbyplaces.category(id),
    customer_id integer references findnearbyplaces.customer(id)
)

create table findnearbyplaces.review
(
    id serial primary key,
    location_id bigint references findnearbyplaces.place(id),
    customer_id integer references findnearbyplaces.customer(id),
    text varchar(512) not null,
    rating char not null
)

create table findnearbyplaces.photo
(
    id serial primary key,
    file bytea not null
)

create table findnearbyplaces.place_photo
(
    location_id bigint references findnearbyplaces.place(id) on delete cascade,
    photo_id integer references findnearbyplaces.photo(id)
)

create table findnearbyplaces.review_photo
(
    review_id integer references findnearbyplaces.review(id),
    photo_id integer references findnearbyplaces.photo(id),
    primary key (review_id, photo_id)
)