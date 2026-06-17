import type { FamilyMember } from '../types/family';

export const mockFamilyData: FamilyMember[] = [
  // Generation 1 (Grandparents)
  {
    id: '1',
    name: 'Budi Wijaya',
    birthDate: '1945-03-15',
    deathDate: '2018-08-20',
    birthPlace: 'Yogyakarta',
    currentLocation: 'Jakarta',
    profession: 'Retired Teacher',
    education: "Bachelor's in Education",
    gender: 'male',
    photoUrl: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=150',
    spouseId: '2',
    childrenIds: ['3', '5'], // Only Andi and Dedi
    isAlive: false,
    generation: 1,
    maritalStatus: 'married',
  },
  {
    id: '2',
    name: 'Siti Wijaya',
    birthDate: '1948-07-22',
    deathDate: '2020-12-10',
    birthPlace: 'Yogyakarta',
    currentLocation: 'Jakarta',
    profession: 'Homemaker',
    gender: 'female',
    photoUrl: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
    spouseId: '1',
    childrenIds: ['3', '5'], // Only Andi and Dedi
    isAlive: false,
    generation: 1,
    maritalStatus: 'married',
  },

  // Generation 2 (Children of Budi & Siti)
  {
    id: '3',
    name: 'Andi Wijaya',
    nickname: 'Mr. Andi',
    birthDate: '1970-05-15',
    birthPlace: 'Jakarta',
    currentLocation: 'South Jakarta',
    profession: 'Entrepreneur',
    education: "Bachelor's in Economics",
    gender: 'male',
    photoUrl: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=150',
    parentIds: ['1', '2'], // Budi & Siti
    childrenIds: ['6', '7'], // Rudi & Maya
    siblingIds: ['5'], // Only Dedi as sibling
    email: 'andi.wijaya@email.com',
    phone: '+62812345678',
    isAlive: true,
    generation: 2,
    maritalStatus: 'married',
  },
  {
    id: '5',
    name: 'Dedi Wijaya',
    birthDate: '1968-11-30',
    birthPlace: 'Jakarta',
    currentLocation: 'Surabaya',
    profession: 'Engineer',
    education: "Bachelor's in Engineering",
    gender: 'male',
    photoUrl: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150',
    parentIds: ['1', '2'], // Budi & Siti
    spouseId: '4', // Sari as wife
    childrenIds: ['8', '9', '10', '11'], // Arif, Lia, Kenzo, Aira
    siblingIds: ['3'], // Only Andi as sibling
    isAlive: true,
    generation: 2,
    maritalStatus: 'married',
  },

  // Sari as Dedi's wife (Generation 2, but not a child of Budi & Siti)
  {
    id: '4',
    name: 'Sari Handayani', // Consistent naming with a different family of origin
    birthDate: '1975-09-08',
    birthPlace: 'Bandung',
    currentLocation: 'Surabaya', // Consistent with family location
    profession: 'Doctor',
    education: "Bachelor's in Medicine",
    gender: 'female',
    photoUrl: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
    spouseId: '5', // Dedi as husband
    childrenIds: ['8', '9', '10', '11'], // Consistent with spacing pattern
    email: 'sari.handayani@email.com',
    phone: '+62812345679',
    isAlive: true,
    generation: 2, // Same generation as Dedi for spacing consistency
    maritalStatus: 'married',
  },

  // Generation 3 (Grandchildren)
  // Andi's children (need to add Andi's wife for completeness)
  {
    id: '6',
    name: 'Rudi Wijaya',
    birthDate: '1998-03-12',
    birthPlace: 'Jakarta',
    currentLocation: 'Jakarta',
    profession: 'Software Engineer',
    education: "Bachelor's in Computer Science",
    gender: 'male',
    photoUrl: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150',
    parentIds: ['3'], // Andi (need Andi's partner for completeness)
    siblingIds: ['7'],
    email: 'rudi.wijaya@email.com',
    phone: '+62812345680',
    isAlive: true,
    generation: 3,
    maritalStatus: 'single',
  },
  {
    id: '7',
    name: 'Maya Wijaya',
    birthDate: '2000-07-18',
    birthPlace: 'Jakarta',
    currentLocation: 'Jakarta',
    profession: 'University Student',
    education: "Bachelor's in Psychology",
    gender: 'female',
    photoUrl: 'https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=150',
    parentIds: ['3'], // Andi
    siblingIds: ['6'],
    email: 'maya.wijaya@email.com',
    phone: '+62812345681',
    isAlive: true,
    generation: 3,
    maritalStatus: 'single',
  },

  // Children of Dedi & Sari
  {
    id: '8',
    name: 'Arif Wijaya',
    birthDate: '1992-01-25',
    birthPlace: 'Surabaya',
    currentLocation: 'Surabaya',
    profession: 'Dentist',
    education: "Bachelor's in Dentistry",
    gender: 'male',
    photoUrl: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=150',
    parentIds: ['5', '4'], // Dedi & Sari as parents
    siblingIds: ['9', '10', '11'],
    isAlive: true,
    generation: 3,
    maritalStatus: 'married',
  },
  {
    id: '9',
    name: 'Lia Wijaya',
    birthDate: '1995-06-14',
    birthPlace: 'Surabaya',
    currentLocation: 'Bandung',
    profession: 'Designer',
    education: "Bachelor's in Design",
    gender: 'female',
    photoUrl: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150',
    parentIds: ['5', '4'], // Dedi & Sari as parents
    siblingIds: ['8', '10', '11'],
    isAlive: true,
    generation: 3,
    maritalStatus: 'single',
  },
  {
    id: '10',
    name: 'Kenzo Wijaya',
    birthDate: '1997-09-03',
    birthPlace: 'Surabaya',
    currentLocation: 'Surabaya',
    profession: 'Photographer',
    education: "Bachelor's in Fine Arts",
    gender: 'male',
    photoUrl: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=150',
    parentIds: ['5', '4'], // Dedi & Sari as parents
    siblingIds: ['8', '9', '11'],
    isAlive: true,
    generation: 3,
    maritalStatus: 'single',
  },
  {
    id: '11',
    name: 'Aira Wijaya',
    birthDate: '1999-12-20',
    birthPlace: 'Surabaya',
    currentLocation: 'Jakarta',
    profession: 'Content Creator',
    education: "Bachelor's in Communications",
    gender: 'female',
    photoUrl: 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=150',
    parentIds: ['5', '4'], // Dedi & Sari as parents
    siblingIds: ['8', '9', '10'],
    isAlive: true,
    generation: 3,
    maritalStatus: 'single',
  },
];